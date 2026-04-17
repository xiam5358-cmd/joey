import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface AnswerInput {
  question_id: string;
  userAnswer?: string;
  user_answer?: string;
}

interface QuestionRecord {
  id: string;
  correct_answer: string;
  score: number;
}

interface AnswerResult {
  submission_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  score: number;
}

// 获取所有提交记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    
    const client = getSupabaseClient();
    let query = client
      .from('submissions')
      .select('*, answers(*)')
      .order('submitted_at', { ascending: false });
    
    if (examId) {
      query = query.eq('exam_id', examId);
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`查询提交记录失败: ${error.message}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 评分函数
function gradeAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionType: string,
  questionScore: number
): { isCorrect: boolean; score: number } {
  const user = userAnswer.trim().toLowerCase();
  const correct = correctAnswer.trim().toLowerCase();

  switch (questionType) {
    case 'choice': // 单选题
      return {
        isCorrect: user === correct,
        score: user === correct ? questionScore : 0,
      };

    case 'multi': // 多选题
      // 支持多种格式：ABC|abc|a,b,c|A,B,C
      const userOptions = user.replace(/[,，\s]+/g, '').split('').sort().join('');
      const correctOptions = correct.replace(/[,，\s]+/g, '').split('').sort().join('');
      const isMultiCorrect = userOptions === correctOptions;
      return {
        isCorrect: isMultiCorrect,
        score: isMultiCorrect ? questionScore : 0,
      };

    case 'judge': // 判断题
      // 支持 T/对/true/正确 和 F/错/false/错误
      const trueOptions = ['t', 'true', '对', '正确', '√', 'yes', 'y', '1'];
      const falseOptions = ['f', 'false', '错', '错误', '×', 'no', 'n', '0'];
      let isJudgeCorrect = false;
      if (trueOptions.includes(user) && trueOptions.includes(correct)) {
        isJudgeCorrect = true;
      } else if (falseOptions.includes(user) && falseOptions.includes(correct)) {
        isJudgeCorrect = true;
      }
      return {
        isCorrect: isJudgeCorrect,
        score: isJudgeCorrect ? questionScore : 0,
      };

    case 'blank': // 填空题
      // 填空题支持多个正确答案（用/分隔）
      const possibleAnswers = correct.split('/').map((a: string) => a.trim().toLowerCase());
      const isBlankCorrect = possibleAnswers.includes(user);
      return {
        isCorrect: isBlankCorrect,
        score: isBlankCorrect ? questionScore : 0,
      };

    case 'essay': // 问答题（人工评分，分值全部给出，后续可人工调整）
      return {
        isCorrect: user.length > 0,
        score: questionScore, // 问答题默认满分，后续可人工调整
      };

    default:
      return {
        isCorrect: user === correct,
        score: user === correct ? questionScore : 0,
      };
  }
}

// 提交答案
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.exam_id || !body.student_name || !body.answers) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 获取题目信息用于评分
    const { data: questions, error: questionsError } = await client
      .from('questions')
      .select('*')
      .eq('exam_id', body.exam_id);
    
    if (questionsError) throw new Error(`查询题目失败: ${questionsError.message}`);
    
    // 创建提交记录
    const { data: submission, error: submissionError } = await client
      .from('submissions')
      .insert({
        exam_id: body.exam_id,
        student_name: body.student_name,
        status: 'pending',
      })
      .select()
      .single();
    
    if (submissionError) throw new Error(`创建提交记录失败: ${submissionError.message}`);
    
    // 评分并保存答案
    let totalScore = 0;
    let autoScore = 0; // 自动评分分数
    const answersWithScore = body.answers.map((answer: AnswerInput) => {
      const question = questions.find((q: QuestionRecord & { type?: string }) => q.id === answer.question_id);
      if (!question) {
        return {
          submission_id: submission.id,
          question_id: answer.question_id,
          user_answer: answer.userAnswer || answer.user_answer,
          is_correct: false,
          score: 0,
        };
      }
      
      const userAnswer = answer.userAnswer || answer.user_answer || '';
      const { isCorrect, score } = gradeAnswer(
        userAnswer,
        question.correct_answer || '',
        question.type || 'blank',
        question.score
      );
      
      // 只有非问答题才计入自动评分
      if (question.type !== 'essay') {
        totalScore += score;
        autoScore += score;
      } else {
        // 问答题标记为待人工评分
        totalScore += score;
      }
      
      return {
        submission_id: submission.id,
        question_id: answer.question_id,
        user_answer: userAnswer,
        is_correct: isCorrect,
        score: score,
      };
    });
    
    // 批量插入答案
    const { error: answersError } = await client
      .from('answers')
      .insert(answersWithScore);
    
    if (answersError) throw new Error(`保存答案失败: ${answersError.message}`);
    
    // 更新提交状态和总分
    const { error: updateError } = await client
      .from('submissions')
      .update({
        status: 'scored',
        total_score: totalScore,
        auto_score: autoScore,
        scored_at: new Date().toISOString(),
      })
      .eq('id', submission.id);
    
    if (updateError) throw new Error(`更新评分结果失败: ${updateError.message}`);
    
    // 获取题目类型统计
    const typeStats = questions.reduce((acc: Record<string, { total: number; correct: number; score: number }>, q: QuestionRecord & { type?: string }) => {
      const type = q.type || 'blank';
      if (!acc[type]) {
        acc[type] = { total: 0, correct: 0, score: 0 };
      }
      acc[type].total++;
      acc[type].score += q.score;
      return acc;
    }, {});
    
    // 统计各类型正确数并收集错题详情
    const wrongQuestions: Array<{
      id: string;
      type: string;
      content: string;
      options: string | null;
      score: number;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }> = [];
    
    answersWithScore.forEach((a: AnswerResult) => {
      const q = questions.find((ques: QuestionRecord) => ques.id === a.question_id);
      if (q) {
        const type = (q as QuestionRecord & { type?: string }).type || 'blank';
        if (a.is_correct) {
          if (typeStats[type]) {
            typeStats[type].correct++;
          }
        } else {
          // 收集错题详情
          wrongQuestions.push({
            id: q.id,
            type: type,
            content: (q as QuestionRecord & { content?: string }).content || '',
            options: (q as QuestionRecord & { options?: string }).options || null,
            score: q.score,
            userAnswer: a.user_answer,
            correctAnswer: q.correct_answer || '',
            isCorrect: a.is_correct,
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        studentName: body.student_name,
        totalScore,
        autoScore,
        maxScore: questions.reduce((sum: number, q: QuestionRecord) => sum + q.score, 0),
        correctCount: answersWithScore.filter((a: AnswerResult) => a.is_correct).length,
        totalCount: answersWithScore.length,
        typeStats,
        wrongQuestions, // 返回错题列表
        submittedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
