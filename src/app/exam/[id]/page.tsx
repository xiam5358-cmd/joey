'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Check, Send, Clock, User, Award, Target, TrendingUp, X, AlertCircle } from 'lucide-react';

interface WrongQuestion {
  id: string;
  type: string;
  content: string;
  options: string | null;
  score: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  total_score: number;
}

interface Question {
  id: string;
  type: 'choice' | 'blank' | 'multi' | 'judge' | 'essay';
  content: string;
  options: { label: string; content: string }[];
  score: number;
  order_index: number;
}

interface QuestionData {
  id: string;
  type: string;
  content: string;
  options: string | null;
  score: number;
  order_index: number;
}

interface Result {
  submissionId: string;
  studentName: string;
  totalScore: number;
  autoScore: number;
  maxScore: number;
  correctCount: number;
  totalCount: number;
  typeStats: Record<string, { total: number; correct: number; score: number }>;
  wrongQuestions: WrongQuestion[];
}

const typeLabels: Record<string, string> = {
  choice: '单选题',
  multi: '多选题',
  judge: '判断题',
  blank: '填空题',
  essay: '问答题',
};

const typeColors: Record<string, string> = {
  choice: 'bg-blue-100 text-blue-700',
  multi: 'bg-purple-100 text-purple-700',
  judge: 'bg-orange-100 text-orange-700',
  blank: 'bg-green-100 text-green-700',
  essay: 'bg-red-100 text-red-700',
};

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = use(params);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [studentName, setStudentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  useEffect(() => {
    loadExam();
  }, [examId]);
  
  const loadExam = async () => {
    try {
      const [examRes, questionsRes] = await Promise.all([
        fetch(`/api/exams/${examId}`),
        fetch(`/api/exams/${examId}/questions`),
      ]);
      
      const examData = await examRes.json();
      const questionsData = await questionsRes.json();
      
      if (examData.success && questionsData.success) {
        setExam(examData.data);
        setQuestions(questionsData.data.map((q: QuestionData) => ({
          ...q,
          type: (q.type || 'blank') as Question['type'],
          options: q.options ? JSON.parse(q.options) : [],
        })));
      }
    } catch (error) {
      console.error('加载试卷失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };
  
  const handleMultiAnswerChange = (questionId: string, optionLabel: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] || '';
      const options = current.split('').filter(Boolean);
      if (checked) {
        options.push(optionLabel);
      } else {
        const index = options.indexOf(optionLabel);
        if (index > -1) options.splice(index, 1);
      }
      return { ...prev, [questionId]: options.sort().join('') };
    });
  };
  
  const handleStartExam = () => {
    if (!studentName.trim()) {
      alert('请输入姓名');
      return;
    }
    setHasStarted(true);
  };
  
  const handleSubmit = async () => {
    if (!studentName.trim()) {
      setShowNameDialog(true);
      return;
    }
    
    if (Object.keys(answers).length < questions.length) {
      const unanswered = questions.filter((q) => !answers[q.id]);
      if (!confirm(`还有 ${unanswered.length} 道题目未作答，确定要提交吗？`)) {
        return;
      }
    }
    
    setSubmitting(true);
    setShowNameDialog(false);
    
    try {
      const formattedAnswers = questions.map((q) => ({
        question_id: q.id,
        userAnswer: answers[q.id] || '',
      }));
      
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: examId,
          student_name: studentName,
          answers: formattedAnswers,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert>
          <AlertDescription>试卷不存在</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // 开始考试页面
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Target className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">{exam.title}</CardTitle>
            {exam.description && (
              <p className="text-slate-500 mt-2">{exam.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{questions.length}</div>
                <p className="text-sm text-slate-500">题目数量</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{exam.total_score}</div>
                <p className="text-sm text-slate-500">总分</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="studentName">请输入你的姓名</Label>
              <Input
                id="studentName"
                placeholder="输入姓名开始考试"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="text-lg text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleStartExam()}
              />
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">考试须知</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>请认真填写姓名，提交后成绩将关联到此姓名</li>
                <li>单选题、判断题、填空题自动评分</li>
                <li>多选题需完全答对才得分</li>
                <li>问答题由人工评分</li>
                <li>提交后可在成绩页面查看排名</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleStartExam}
              disabled={!studentName.trim()}
            >
              <Check className="w-5 h-5 mr-2" />
              开始答题
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // 显示结果
  if (result) {
    const accuracy = Math.round((result.autoScore / result.maxScore) * 100);
    const passed = accuracy >= 60;
    const grade = accuracy >= 90 ? '优秀' : accuracy >= 80 ? '良好' : accuracy >= 60 ? '及格' : '不及格';
    
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                passed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Award className={`w-10 h-10 ${passed ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <CardTitle className="text-2xl">
                {passed ? '恭喜！' : '继续加油！'}
              </CardTitle>
              <p className="text-slate-500 mt-1">考生：{result.studentName}</p>
              <Badge variant={passed ? 'default' : 'destructive'} className="mt-2 text-lg px-4 py-1">
                {grade}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 总分 */}
              <div className="text-center">
                <div className="text-6xl font-bold text-slate-900 mb-2">
                  {result.totalScore}
                  <span className="text-2xl text-slate-500">/{result.maxScore}</span>
                </div>
                <p className="text-slate-500">最终得分（问答题待人工评分）</p>
              </div>
              
              {/* 自动评分部分 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-800">客观题得分</span>
                  <span className="text-xl font-bold text-blue-600">{result.autoScore}分</span>
                </div>
                <Progress value={accuracy} className="h-3" />
                <div className="flex justify-between text-sm text-blue-600 mt-2">
                  <span>正确率 {accuracy}%</span>
                  <span>答对 {result.correctCount}/{result.totalCount} 题</span>
                </div>
              </div>
              
              {/* 各题型统计 */}
              {result.typeStats && (
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-700">各题型得分</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.typeStats).map(([type, stats]) => (
                      <div key={type} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${typeColors[type] || 'bg-slate-100'}`}>
                            {typeLabels[type] || type}
                          </span>
                          <span className="text-sm font-medium">
                            {stats.correct}/{stats.total}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-slate-800">
                          {stats.score}分
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 提示 */}
              {Object.keys(result.typeStats || {}).includes('essay') && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-700">
                    问答题已标记满分，实际得分待教师人工评分后确认。
                  </p>
                </div>
              )}
              
              {/* 错题列表 */}
              {result.wrongQuestions && result.wrongQuestions.length > 0 && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-lg">错题回顾</h3>
                    <Badge variant="destructive">{result.wrongQuestions.length}题</Badge>
                  </div>
                  <p className="text-sm text-slate-500">以下是您答错的题目，方便复习和老师讲解时参考</p>
                  
                  <div className="space-y-4">
                    {result.wrongQuestions.map((wq, index) => {
                      const options = wq.options ? JSON.parse(wq.options) : [];
                      const displayIndex = result.totalCount - result.wrongQuestions.length + index + 1;
                      return (
                        <Card key={wq.id} className="border-red-200 bg-red-50/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-red-500 text-white text-sm flex items-center justify-center font-medium">
                                  {index + 1}
                                </span>
                                <Badge className={typeColors[wq.type] || 'bg-slate-100'}>
                                  {typeLabels[wq.type] || wq.type}
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-red-600 border-red-300">
                                -{wq.score}分
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* 题目内容 */}
                            <div className="bg-white rounded-lg p-4">
                              <p className="font-medium text-slate-800 whitespace-pre-wrap">
                                {wq.content.replace(/__/g, '_____')}
                              </p>
                            </div>
                            
                            {/* 选项（如果是选择题或多选题） */}
                            {wq.type === 'choice' || wq.type === 'multi' ? (
                              <div className="bg-white rounded-lg p-4 space-y-2">
                                {options.map((opt: { label: string; content: string }) => {
                                  const isUserAnswer = wq.userAnswer.includes(opt.label);
                                  const isCorrectAnswer = wq.correctAnswer.includes(opt.label);
                                  let bgClass = 'bg-slate-50';
                                  let borderClass = 'border-slate-200';
                                  if (isCorrectAnswer) {
                                    bgClass = 'bg-green-100';
                                    borderClass = 'border-green-500';
                                  } else if (isUserAnswer && !isCorrectAnswer) {
                                    bgClass = 'bg-red-100';
                                    borderClass = 'border-red-500';
                                  }
                                  return (
                                    <div
                                      key={opt.label}
                                      className={`p-3 rounded-lg border ${borderClass} ${bgClass}`}
                                    >
                                      <span className="font-medium mr-2">{opt.label}.</span>
                                      <span>{opt.content}</span>
                                      {isUserAnswer && (
                                        <span className="ml-2 text-sm">
                                          {isCorrectAnswer ? (
                                            <Check className="w-4 h-4 inline text-green-600" />
                                          ) : (
                                            <X className="w-4 h-4 inline text-red-600" />
                                          )}
                                        </span>
                                      )}
                                      {isCorrectAnswer && !isUserAnswer && (
                                        <span className="ml-2 text-sm text-green-600 font-medium">
                                          正确答案
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            
                            {/* 判断题答案展示 */}
                            {wq.type === 'judge' ? (
                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center gap-4">
                                  <div>
                                    <span className="text-sm text-slate-500">您的答案：</span>
                                    <span className={`font-medium ${
                                      wq.userAnswer === 'T' ? 'text-green-600' : 
                                      wq.userAnswer === 'F' ? 'text-red-600' : 'text-slate-800'
                                    }`}>
                                      {wq.userAnswer === 'T' ? '正确/对' : 
                                       wq.userAnswer === 'F' ? '错误/错' : 
                                       wq.userAnswer || '(未作答)'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-sm text-slate-500">正确答案：</span>
                                    <span className="font-medium text-green-600">
                                      {wq.correctAnswer === 'T' ? '正确/对' : '错误/错'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            
                            {/* 填空题答案展示 */}
                            {wq.type === 'blank' ? (
                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex-1">
                                    <span className="text-sm text-slate-500">您的答案：</span>
                                    <span className="font-medium text-red-600">
                                      {wq.userAnswer || '(未作答)'}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm text-slate-500">正确答案：</span>
                                    <span className="font-medium text-green-600">
                                      {wq.correctAnswer}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex gap-3">
                <Link href="/admin" className="flex-1">
                  <Button variant="outline" className="w-full">
                    查看所有成绩
                  </Button>
                </Link>
                <Link href="/" className="flex-1">
                  <Button className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    返回首页
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  
  // 渲染不同题型的选项
  const renderOptions = () => {
    switch (currentQuestion.type) {
      case 'choice':
        return (
          <RadioGroup
            value={answers[currentQuestion.id] || ''}
            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
          >
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <div
                  key={option.label}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    answers[currentQuestion.id] === option.label
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:border-slate-300'
                  }`}
                  onClick={() => handleAnswerChange(currentQuestion.id, option.label)}
                >
                  <RadioGroupItem value={option.label} className="mr-3" />
                  <span className="font-medium mr-2">{option.label}.</span>
                  <span>{option.content}</span>
                </div>
              ))}
            </div>
          </RadioGroup>
        );
        
      case 'multi':
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">提示：多选题，请选择所有正确答案</p>
            {currentQuestion.options.map((option) => {
              const selectedOptions = answers[currentQuestion.id]?.split('') || [];
              const isSelected = selectedOptions.includes(option.label);
              return (
                <div
                  key={option.label}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'hover:border-slate-300'
                  }`}
                  onClick={() => handleMultiAnswerChange(currentQuestion.id, option.label, !isSelected)}
                >
                  <Checkbox 
                    checked={isSelected}
                    className="mr-3"
                  />
                  <span className="font-medium mr-2">{option.label}.</span>
                  <span>{option.content}</span>
                </div>
              );
            })}
            {answers[currentQuestion.id] && (
              <p className="text-sm text-purple-600 font-medium">
                已选择：{answers[currentQuestion.id]}
              </p>
            )}
          </div>
        );
        
      case 'judge':
        return (
          <RadioGroup
            value={answers[currentQuestion.id] || ''}
            onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
          >
            <div className="flex gap-4">
              <div
                className={`flex-1 p-6 border-2 rounded-lg cursor-pointer text-center transition-colors ${
                  answers[currentQuestion.id] === 'T'
                    ? 'border-green-500 bg-green-50'
                    : 'hover:border-slate-300'
                }`}
                onClick={() => handleAnswerChange(currentQuestion.id, 'T')}
              >
                <RadioGroupItem value="T" className="sr-only" />
                <span className="text-4xl text-green-600">√</span>
                <span className="block mt-2 font-medium">正确/对</span>
              </div>
              <div
                className={`flex-1 p-6 border-2 rounded-lg cursor-pointer text-center transition-colors ${
                  answers[currentQuestion.id] === 'F'
                    ? 'border-red-500 bg-red-50'
                    : 'hover:border-slate-300'
                }`}
                onClick={() => handleAnswerChange(currentQuestion.id, 'F')}
              >
                <RadioGroupItem value="F" className="sr-only" />
                <span className="text-4xl text-red-600">×</span>
                <span className="block mt-2 font-medium">错误/错</span>
              </div>
            </div>
          </RadioGroup>
        );
        
      case 'essay':
        return (
          <div className="space-y-2">
            <Label htmlFor={`answer-${currentQuestion.id}`}>请作答</Label>
            <textarea
              id={`answer-${currentQuestion.id}`}
              className="w-full min-h-[200px] p-4 border rounded-lg resize-y"
              placeholder="请输入你的答案..."
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
            />
            <p className="text-sm text-slate-500">
              {answers[currentQuestion.id]?.length || 0} 字
            </p>
          </div>
        );
        
      default: // blank
        return (
          <div className="space-y-2">
            <Label htmlFor={`answer-${currentQuestion.id}`}>请输入答案</Label>
            <Input
              id={`answer-${currentQuestion.id}`}
              placeholder="在此输入答案..."
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
            />
          </div>
        );
    }
  };
  
  const getTypeLabel = (type: string) => {
    return typeLabels[type] || type;
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-slate-500" />
              <span className="font-medium">{studentName}</span>
            </div>
            <h1 className="font-medium truncate max-w-[200px]">{exam.title}</h1>
            <Badge variant="secondary">
              <Clock className="w-3 h-3 mr-1" />
              {answeredCount}/{questions.length}
            </Badge>
          </div>
          <Progress value={progress} className="mt-4 h-1" />
        </div>
      </header>
      
      {/* 答题区 */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-2">
              <Badge variant="outline">
                第 {currentIndex + 1} 题 / 共 {questions.length} 题
              </Badge>
              <Badge variant="secondary">
                {currentQuestion.score} 分
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded ${typeColors[currentQuestion.type] || 'bg-slate-100'}`}>
                {getTypeLabel(currentQuestion.type)}
              </span>
              {currentQuestion.type === 'multi' && (
                <span className="text-xs text-slate-500">(多选)</span>
              )}
            </div>
            <CardTitle className="text-xl mt-4">
              {currentQuestion.content}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderOptions()}
          </CardContent>
        </Card>
        
        {/* 导航按钮 */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            上一题
          </Button>
          
          {currentIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              <Send className="w-4 h-4 mr-2" />
              {submitting ? '提交中...' : '提交试卷'}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            >
              下一题
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
        
        {/* 题目导航 */}
        <Card className="mt-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">题目导航</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-8 gap-2">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center font-medium transition-colors text-xs ${
                    index === currentIndex
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : answers[q.id]
                      ? 'border-green-500 bg-green-100 text-green-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-100" />
                当前
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-100" />
                已答
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded border-2 border-slate-200" />
                未答
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 题型图例 */}
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeLabels).map(([type, label]) => (
                <div key={type} className={`text-xs px-2 py-1 rounded ${typeColors[type]}`}>
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
      
      {/* 姓名对话框 */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>请输入你的姓名</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="请输入姓名"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="text-lg"
              />
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowNameDialog(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={() => {
                if (studentName.trim()) {
                  setShowNameDialog(false);
                  handleSubmit();
                }
              }} className="flex-1">
                确认并提交
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
