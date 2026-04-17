import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface ParsedQuestion {
  type: string;
  content: string;
  options?: { label: string; content: string }[];
  correctAnswer: string;
  score: number;
}

// 解析文本内容为题目
function parseTextToQuestions(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  // 清理文本
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\u200b/g, '');
  
  // 移除无关内容
  text = text.replace(/考试时间[：:]\s*\d+分钟/gi, '');
  text = text.replace(/姓名[：:]\s*__________/g, '');
  text = text.replace(/得分[：:]\s*__________/g, '');
  text = text.replace(/满分[：:]\s*\d+分/g, '');
  
  // 方法1: 支持 [type] 标记格式
  const typeMarkers = ['choice', 'multi', 'judge', 'blank', 'essay'];
  const markerPattern = new RegExp(`\\[(${typeMarkers.join('|')})\\]`, 'gi');
  const segments = text.split(markerPattern);
  
  for (let i = 1; i < segments.length; i += 2) {
    const type = segments[i]?.toLowerCase();
    const content = segments[i + 1];
    if (!type || !content) continue;
    
    const question = parseQuestionBlock(type, content.trim());
    if (question) questions.push(question);
  }
  
  // 方法2: 如果没有 [type] 标记，按部分解析
  if (questions.length < 5) {
    parseBySections(text, questions);
  }
  
  // 方法3: 如果按部分解析失败，逐行解析
  if (questions.length < 5) {
    parseLinesDirectly(text, questions);
  }
  
  return questions;
}

// 按部分解析题目
function parseBySections(text: string, questions: ParsedQuestion[]) {
  // 找到所有"第X部分"标题的位置
  const partTitleRegex = /#{0,2}\s*第[一二三四五六七八九十零]+部分[：:：]?[^\n]*/gi;
  const matches = [...text.matchAll(partTitleRegex)];
  
  if (matches.length === 0) {
    // 没有找到部分标题，使用逐行解析
    parseLinesDirectly(text, questions);
    return;
  }
  
  // 解析每个部分
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const titleStart = match.index || 0;
    const titleEnd = titleStart + match[0].length;
    
    // 获取内容范围：从标题结束到下一个标题开始（或文件末尾）
    const contentStart = titleEnd;
    const contentEnd = i + 1 < matches.length ? (matches[i + 1].index || 0) : text.length;
    const partTitle = match[0];
    const partContent = text.substring(contentStart, contentEnd);
    
    // 跳过空内容
    if (!partContent.trim()) continue;
    
    const titleUpper = partTitle.toUpperCase();
    const contentUpper = partContent.toUpperCase();
    
    if (contentUpper.includes('填空') || titleUpper.includes('填空')) {
      parseFillInBlank(partContent, questions);
    } else if (contentUpper.includes('判断') || titleUpper.includes('判断')) {
      parseJudgeQuestions(partContent, questions);
    } else if (contentUpper.includes('单项选择') || 
               (titleUpper.includes('选择') && !titleUpper.includes('多项'))) {
      parseChoiceQuestions(partContent, questions, 'choice');
    } else if (contentUpper.includes('多项选择') || titleUpper.includes('多项选择')) {
      parseChoiceQuestions(partContent, questions, 'multi');
    } else if (contentUpper.includes('问答') || 
               contentUpper.includes('简答') ||
               contentUpper.includes('论述') ||
               titleUpper.includes('问答') ||
               titleUpper.includes('简答')) {
      parseEssayQuestions(partContent, questions);
    }
  }
  
  // 如果按部分解析没有找到足够的题目，尝试逐行解析
  if (questions.length < 5) {
    parseLinesDirectly(text, questions);
  }
}

// 解析填空题
function parseFillInBlank(section: string, questions: ParsedQuestion[]) {
  const lines = section.split('\n');
  let currentQuestion = '';
  let isInQuestion = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 跳过标题行
    if (/^第[一二三四五六七八九十零]+部分/.test(trimmed) || 
        /^#{1,3}\s/.test(trimmed) || 
        trimmed.includes('填空题') || 
        /^考试时间/.test(trimmed) ||
        trimmed.includes('每空') ||
        (trimmed.includes('共') && trimmed.includes('分'))) continue;
    
    // 检测新题目开始（数字编号）
    if (/^\d+[.、)]\s/.test(trimmed)) {
      if (currentQuestion && isInQuestion) {
        addFillQuestion(currentQuestion, questions);
      }
      currentQuestion = trimmed;
      isInQuestion = true;
    } else if (isInQuestion) {
      // 继续收集题目内容（可能是多行）
      if (/^\d+[.、)]\s/.test(trimmed)) {
        addFillQuestion(currentQuestion, questions);
        currentQuestion = trimmed;
      } else if (trimmed.length < 300) {
        currentQuestion += ' ' + trimmed;
      }
    }
  }
  
  if (currentQuestion && isInQuestion) {
    addFillQuestion(currentQuestion, questions);
  }
}

function addFillQuestion(text: string, questions: ParsedQuestion[]) {
  // 计算空的数量
  const blankMatches = text.match(/_{2,}/g) || [];
  const blankCount = blankMatches.length;
  if (blankCount === 0) return;
  
  // 提取答案 - 查找题目末尾的答案
  let answer = '';
  const answerMatch = text.match(/答案[：:]\s*([^|]+)$/);
  if (answerMatch) {
    answer = answerMatch[1].trim()
      .replace(/；/g, '/')
      .replace(/；/g, '/');
  } else {
    // 尝试从题目内容中提取答案（答案在空白处后面的内容）
    const inlineAnswerMatch = text.match(/_{2,}[^_]*?答案[：:]\s*([^|]+)/);
    if (inlineAnswerMatch) {
      answer = inlineAnswerMatch[1].trim().replace(/；/g, '/');
    }
  }
  
  // 清理内容 - 将多个下划线转为单个下划线，移除答案
  const content = text
    .replace(/^\d+[.、)]\s*/, '')
    .replace(/\s*答案[：:]\s*[^|]+$/, '')
    .replace(/_{2,}[^_]*?答案[：:]\s*[^|]+/g, '')
    .replace(/_{2,}/g, '__');
  
  questions.push({
    type: 'blank',
    content,
    correctAnswer: answer,
    score: blankCount * 2,
  });
}

// 解析判断题
function parseJudgeQuestions(section: string, questions: ParsedQuestion[]) {
  const lines = section.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 跳过标题行
    if (/^第[一二三四五六七八九十零]+部分/.test(trimmed) || 
        /^#{1,3}\s/.test(trimmed) ||
        trimmed.includes('判断题') || 
        (trimmed.includes('每题') && trimmed.includes('分'))) continue;
    
    // 匹配判断题格式：1. 题目内容（ √ ）或 1. 题目内容（ × ）
    const match = trimmed.match(/^(\d+)[.、)]\s*(.+?)\s*[\(（]\s*([√✓✔对错✗×TF])\s*[\)）]/);
    if (match) {
      let answer = 'T';
      if (/[错✗×F]/.test(match[3])) answer = 'F';
      
      questions.push({
        type: 'judge',
        content: match[2].trim(),
        correctAnswer: answer,
        score: 2,
      });
      continue;
    }
    
    // 备选格式：题目内容（ √ ）
    const altMatch = trimmed.match(/^(\d+)[.、)]\s*(.+?)[\(（]\s*([√✓✔对错✗×TF])[\)）]/);
    if (altMatch) {
      let answer = 'T';
      if (/[错✗×F]/.test(altMatch[3])) answer = 'F';
      
      questions.push({
        type: 'judge',
        content: altMatch[2].trim(),
        correctAnswer: answer,
        score: 2,
      });
    }
  }
}

// 解析选择题
function parseChoiceQuestions(section: string, questions: ParsedQuestion[], type: 'choice' | 'multi') {
  const lines = section.split('\n');
  let currentQuestion = '';
  let options: { label: string; content: string }[] = [];
  let pendingAnswer = '';
  let pendingScore = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 跳过标题行
    if (/^第[一二三四五六七八九十零]+部分/.test(trimmed) || 
        /^#{1,3}\s/.test(trimmed) ||
        (trimmed.includes('选择') && !trimmed.match(/[A-D][.、)]/)) || 
        (trimmed.includes('每题') && trimmed.includes('分'))) continue;
    
    // 处理同一行中包含题目和选项的情况
    // 例如: "1. 题目内容？ A. 选项A B. 选项B C. 选项C D. 选项D"
    const inlineMatch = trimmed.match(/^(\d+)[.、)]\s*(.+?)\s+([A-D])[.、)]\s*(.+?)\s+([A-D])[.、)]\s*(.+?)\s+([A-D])[.、)]\s*(.+?)\s+([A-D])[.、)]\s*(.+)/);
    if (inlineMatch) {
      // 保存之前的题目
      if (currentQuestion && options.length >= 2) {
        saveChoiceQuestion(currentQuestion, options, pendingAnswer, pendingScore, questions, type);
      }
      // 提取同一行中的题目和选项
      currentQuestion = inlineMatch[2].trim();
      options = [
        { label: inlineMatch[3], content: inlineMatch[4].trim() },
        { label: inlineMatch[5], content: inlineMatch[6].trim() },
        { label: inlineMatch[7], content: inlineMatch[8].trim() },
        { label: inlineMatch[9], content: inlineMatch[10].trim() }
      ];
      pendingAnswer = '';
      pendingScore = 0;
      continue;
    }
    
    // 选项（以 A. B. C. D. 开头）
    const optionMatch = trimmed.match(/^([A-D])[.、)]\s*(.+)/);
    if (optionMatch) {
      options.push({ label: optionMatch[1], content: optionMatch[2].trim() });
      continue;
    }
    
    // 新题目开始（数字编号）
    if (/^\d+[.、)]\s*[\u4e00-\u9fa5]/.test(trimmed) && !trimmed.match(/^[A-D][.、)]\s*/)) {
      // 保存之前的题目
      if (currentQuestion && options.length >= 2) {
        saveChoiceQuestion(currentQuestion, options, pendingAnswer, pendingScore, questions, type);
      }
      currentQuestion = trimmed;
      options = [];
      pendingAnswer = '';
      pendingScore = 0;
      continue;
    }
    
    // 答案行（单独一行）
    if (/^答案[：:]/.test(trimmed)) {
      pendingAnswer = trimmed;
      continue;
    }
    
    // 分值行
    const scoreMatch = trimmed.match(/分值[：:]?\s*(\d+)/);
    if (scoreMatch) {
      pendingScore = parseInt(scoreMatch[1]);
      continue;
    }
    
    // 如果是题目内容的延续
    if (currentQuestion && options.length === 0 && trimmed.length < 200) {
      currentQuestion += ' ' + trimmed;
    }
  }
  
  // 处理最后一道题
  if (currentQuestion && options.length >= 2) {
    saveChoiceQuestion(currentQuestion, options, pendingAnswer, pendingScore, questions, type);
  }
}

function saveChoiceQuestion(
  content: string, 
  options: { label: string; content: string }[],
  pendingAnswer: string,
  pendingScore: number,
  questions: ParsedQuestion[],
  type: 'choice' | 'multi'
) {
  // 提取答案
  const answerMatch = pendingAnswer.match(/答案[：:]\s*([A-D]+)/) || 
                      content.match(/答案[：:]\s*([A-D]+)/);
  
  // 清理题目内容
  const cleanContent = content
    .replace(/^\d+[.、)]\s*/, '')
    .replace(/\s*[A-D][.、)][^|]+/g, '')
    .replace(/\s*答案[：:]\s*[A-D]+.*$/, '');
  
  // 提取分值
  const scoreMatch = content.match(/分值[：:]?\s*(\d+)/);
  const score = pendingScore || scoreMatch ? parseInt(scoreMatch?.[1] || String(pendingScore)) : (type === 'multi' ? 3 : 2);
  
  questions.push({
    type,
    content: cleanContent,
    options: options.slice(0, 4),
    correctAnswer: answerMatch?.[1] || 'A',
    score,
  });
}

// 解析问答题
function parseEssayQuestions(section: string, questions: ParsedQuestion[]) {
  const lines = section.split('\n');
  let currentQuestion = '';
  let isInQuestion = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 跳过标题行
    if (/^第[一二三四五六七八九十零]+部分/.test(trimmed) || 
        /^#{1,3}\s/.test(trimmed) ||
        trimmed.includes('问答') || 
        trimmed.includes('简答') ||
        (trimmed.includes('每题') && trimmed.includes('分'))) continue;
    
    // 检测新题目开始（数字编号）
    if (/^\d+[.、)]\s/.test(trimmed)) {
      if (currentQuestion && isInQuestion) {
        addEssayQuestion(currentQuestion, questions);
      }
      currentQuestion = trimmed;
      isInQuestion = true;
    } else if (isInQuestion) {
      // 继续收集题目内容（可能是多行）
      if (/^\d+[.、)]\s/.test(trimmed)) {
        addEssayQuestion(currentQuestion, questions);
        currentQuestion = trimmed;
      } else if (trimmed.length < 300) {
        currentQuestion += ' ' + trimmed;
      }
    }
  }
  
  if (currentQuestion && isInQuestion) {
    addEssayQuestion(currentQuestion, questions);
  }
}

function addEssayQuestion(text: string, questions: ParsedQuestion[]) {
  const scoreMatch = text.match(/分值[：:]?\s*(\d+)/);
  
  // 清理题目
  const cleanContent = text
    .replace(/^\d+[.、)]\s*/, '')
    .replace(/\s*分值[：:]?\s*\d+.*$/, '');
  
  if (cleanContent.length < 10) return;
  
  questions.push({
    type: 'essay',
    content: cleanContent,
    correctAnswer: '',
    score: scoreMatch ? parseInt(scoreMatch[1]) : 6,
  });
}

// 逐行解析
function parseLinesDirectly(text: string, questions: ParsedQuestion[]) {
  const lines = text.split('\n');
  let currentQuestion = '';
  let options: { label: string; content: string }[] = [];
  let currentType = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 填空题
    if (/_+/.test(trimmed)) {
      const blankCount = (trimmed.match(/_+/g) || []).length;
      const answerMatch = trimmed.match(/答案[：:]\s*([^|]+)/);
      questions.push({
        type: 'blank',
        content: trimmed.replace(/^\d+[.、)]\s*/, '').replace(/_+/g, '__').replace(/\s*答案[：:]\s*[^|]+/, ''),
        correctAnswer: answerMatch?.[1]?.replace(/；/g, '/') || '',
        score: blankCount * 2,
      });
      continue;
    }
    
    // 判断题
    const judgeMatch = trimmed.match(/^(\d+)[.、)]\s*(.+?)[\(（]\s*([√✓✔对错✗×TF])[\)）]/);
    if (judgeMatch) {
      let answer = 'T';
      if (/[错✗×F]/.test(judgeMatch[3])) answer = 'F';
      questions.push({
        type: 'judge',
        content: judgeMatch[2].trim(),
        correctAnswer: answer,
        score: 2,
      });
      continue;
    }
    
    // 选项
    const optionMatch = trimmed.match(/^([A-D])[.、)]\s*(.+)/);
    if (optionMatch) {
      options.push({ label: optionMatch[1], content: optionMatch[2].trim() });
      currentType = options.length >= 4 ? 'choice' : 'multi';
      continue;
    }
    
    // 新题目
    if (/^\d+[.、)]\s*[\u4e00-\u9fa5]/.test(trimmed) && !trimmed.match(/^[A-D][.、)]\s*/)) {
      if (currentQuestion && options.length >= 2) {
        const answerMatch = currentQuestion.match(/答案[：:]\s*([A-D]+)/);
        questions.push({
          type: currentType || 'choice',
          content: currentQuestion.replace(/^\d+[.、)]\s*/, '').replace(/\s*答案[：:]\s*[A-D]+.*$/, ''),
          options: options.slice(0, 4),
          correctAnswer: answerMatch?.[1] || 'A',
          score: currentType === 'multi' ? 3 : 2,
        });
      }
      currentQuestion = trimmed;
      options = [];
      currentType = '';
      continue;
    }
    
    // 问答题
    if (trimmed.length > 20 && (trimmed.includes('请') || trimmed.includes('简述') || trimmed.includes('说明') || trimmed.includes('什么') || trimmed.includes('如何'))) {
      const scoreMatch = trimmed.match(/分值[：:]?\s*(\d+)/);
      questions.push({
        type: 'essay',
        content: trimmed.replace(/^\d+[.、)]\s*/, '').replace(/\s*分值[：:]?\s*\d+.*$/, ''),
        correctAnswer: '',
        score: scoreMatch ? parseInt(scoreMatch[1]) : 6,
      });
    }
  }
  
  // 处理最后一道题
  if (currentQuestion && options.length >= 2) {
    const answerMatch = currentQuestion.match(/答案[：:]\s*([A-D]+)/);
    questions.push({
      type: currentType || 'choice',
      content: currentQuestion.replace(/^\d+[.、)]\s*/, '').replace(/\s*答案[：:]\s*[A-D]+.*$/, ''),
      options: options.slice(0, 4),
      correctAnswer: answerMatch?.[1] || 'A',
      score: currentType === 'multi' ? 3 : 2,
    });
  }
}

// 解析单个题目块
function parseQuestionBlock(type: string, block: string): ParsedQuestion | null {
  const clean = block.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim();
  
  if (!clean || clean.length < 3) return null;
  
  let answer = '';
  let score = 5;
  let content = clean;
  
  // 提取答案
  const answerMatch = clean.match(/答案[：:]\s*([A-D]+|[对错√×TF全正确全错误]+|[^|分]+)/);
  if (answerMatch) {
    answer = answerMatch[1].trim();
    content = clean.substring(0, answerMatch.index).trim();
  }
  
  // 提取分值
  const scoreMatch = clean.match(/分值[：:]?\s*(\d+)/);
  if (scoreMatch) {
    score = parseInt(scoreMatch[1]);
  }
  
  if (type === 'choice') {
    const optionMatches = clean.match(/([A-D])[.、）)]\s*([^|]+)/g);
    if (optionMatches && optionMatches.length >= 4) {
      const options: { label: string; content: string }[] = [];
      for (const opt of optionMatches) {
        const m = opt.match(/([A-D])[.、）)]\s*(.+)/);
        if (m) options.push({ label: m[1], content: m[2].trim() });
      }
      if (options.length >= 4) {
        let correctAnswer = answer.toUpperCase().charAt(0);
        if (!/^[A-D]$/.test(correctAnswer)) correctAnswer = 'A';
        return {
          type: 'choice',
          content: content.replace(/\|.*$/, '').trim(),
          options,
          correctAnswer,
          score,
        };
      }
    }
  } else if (type === 'multi') {
    const optionMatches = clean.match(/([A-D])[.、）)]\s*([^|]+)/g);
    if (optionMatches && optionMatches.length >= 2) {
      const options: { label: string; content: string }[] = [];
      for (const opt of optionMatches) {
        const m = opt.match(/([A-D])[.、）)]\s*(.+)/);
        if (m) options.push({ label: m[1], content: m[2].trim() });
      }
      if (options.length >= 2) {
        return {
          type: 'multi',
          content: content.replace(/\|.*$/, '').trim(),
          options,
          correctAnswer: answer.toUpperCase(),
          score,
        };
      }
    }
  } else if (type === 'judge') {
    let correctAnswer = 'T';
    if (/错|错误|F|×|全错误/.test(answer)) {
      correctAnswer = 'F';
    }
    return {
      type: 'judge',
      content: content.replace(/\|.*$/, '').replace(/\s*答案[：:].*$/, '').trim(),
      correctAnswer,
      score,
    };
  } else if (type === 'essay') {
    return {
      type: 'essay',
      content: content.replace(/\|.*$/, '').trim(),
      correctAnswer: answer,
      score,
    };
  } else {
    return {
      type: 'blank',
      content: content.replace(/\|.*$/, '').trim(),
      correctAnswer: answer.replace(/；/g, '/'),
      score,
    };
  }
  
  return parseQuestionBlockFallback(type, block);
}

function parseQuestionBlockFallback(type: string, block: string): ParsedQuestion | null {
  const clean = block.trim();
  if (!clean) return null;
  
  const optionMatches = clean.match(/([A-D])[.、）)]\s*([^(A-D)]+)/g);
  
  if (type === 'choice' && optionMatches && optionMatches.length >= 4) {
    const options: { label: string; content: string }[] = [];
    for (const opt of optionMatches) {
      const m = opt.match(/([A-D])[.、）)]\s*(.+)/);
      if (m) options.push({ label: m[1], content: m[2].trim() });
    }
    if (options.length >= 4) {
      return {
        type: 'choice',
        content: clean.split(/[A-D][.、）)]/)[0].trim(),
        options,
        correctAnswer: 'A',
        score: 5,
      };
    }
  }
  
  if (clean.length > 10) {
    return {
      type: type || 'essay',
      content: clean.substring(0, 200),
      correctAnswer: '',
      score: 5,
    };
  }
  
  return null;
}

// 处理 docx 文件
async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// 处理 pdf 文件
async function parsePdfWithLibreOffice(buffer: Buffer, _fileName: string): Promise<string> {
  const tempDir = '/tmp';
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input_${timestamp}.pdf`);
  
  await fs.writeFile(inputPath, buffer);
  
  try {
    await execAsync(`soffice --headless --convert-to html "${inputPath}" --outdir "${tempDir}" 2>/dev/null`);
    
    const files = await fs.readdir(tempDir);
    const htmlFile = files.find(f => f.startsWith(`input_${timestamp}`) && f.endsWith('.html'));
    
    if (htmlFile) {
      const htmlContent = await fs.readFile(path.join(tempDir, htmlFile), 'utf-8');
      const text = htmlContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n');
      
      await fs.unlink(path.join(tempDir, htmlFile)).catch(() => {});
      return text;
    }
  } catch (e) {
    console.error('LibreOffice conversion failed:', e);
  }
  
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 });
    }
    
    const ext = path.extname(file.name).toLowerCase();
    const allowedExts = ['.txt', '.md', '.docx', '.pdf'];
    
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ 
        error: '不支持的文件格式，仅支持 txt、md、docx、pdf' 
      }, { status: 400 });
    }
    
    let text = '';
    
    if (ext === '.txt' || ext === '.md') {
      text = await file.text();
    } else if (ext === '.docx') {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await parseDocx(buffer);
    } else if (ext === '.pdf') {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await parsePdfWithLibreOffice(buffer, file.name);
      if (!text) {
        return NextResponse.json({ 
          error: 'PDF解析失败，请将PDF转换为txt或docx格式后重试' 
        }, { status: 400 });
      }
    }
    
    const questions = parseTextToQuestions(text);
    
    if (questions.length === 0) {
      return NextResponse.json({ 
        error: '未能识别到题目，请检查文件格式是否正确',
        debug: text.substring(0, 500)
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true,
      data: {
        fileName: file.name,
        questionCount: questions.length,
        questions,
        summary: {
          choice: questions.filter(q => q.type === 'choice').length,
          multi: questions.filter(q => q.type === 'multi').length,
          judge: questions.filter(q => q.type === 'judge').length,
          blank: questions.filter(q => q.type === 'blank').length,
          essay: questions.filter(q => q.type === 'essay').length,
        }
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: '文件处理失败: ' + (error instanceof Error ? error.message : '未知错误') 
    }, { status: 500 });
  }
}
