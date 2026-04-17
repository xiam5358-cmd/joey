'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Plus, BookOpen, Clock, FileText, Trash2, Upload, Play, UploadCloud, File, CheckCircle, Loader2, Lock } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  description: string;
  total_score: number;
  created_at: string;
  is_hidden?: boolean;
  questions?: { count: number }[];
}

interface Question {
  type: string;
  content: string;
  options?: { label: string; content: string }[];
  correctAnswer: string;
  score: number;
}

interface UploadResult {
  fileName: string;
  questionCount: number;
  questions: Question[];
  rawText: string;
}

export default function HomePage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  // 创建试卷表单
  const [newExam, setNewExam] = useState({
    title: '',
    description: '',
    totalScore: 100,
  });
  
  // 上传题目
  const [examSelect, setExamSelect] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 加载试卷列表
  const loadExams = async () => {
    try {
      // 只获取未隐藏的试卷
      const res = await fetch('/api/exams');
      const result = await res.json();
      if (result.success) {
        setExams(result.data);
      }
    } catch (error) {
      console.error('加载试卷失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadExams();
  }, []);
  
  // 创建试卷
  const handleCreateExam = async () => {
    if (!newExam.title.trim()) return;
    
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam),
      });
      const result = await res.json();
      
      if (result.success) {
        setCreateDialogOpen(false);
        setNewExam({ title: '', description: '', totalScore: 100 });
        loadExams();
      } else {
        alert(result.error);
      }
    } catch {
      console.error('创建试卷失败');
    }
  };
  
  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setUploadError('');
    setUploadResult(null);
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      
      if (result.success) {
        setUploadResult(result.data);
      } else {
        setUploadError(result.error);
      }
    } catch {
      setUploadError('文件上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };
  
  // 文件选择处理
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  
  // 拖拽处理
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  
  // 上传题目到试卷
  const handleConfirmUpload = async () => {
    if (!examSelect || !uploadResult || uploadResult.questions.length === 0) return;
    
    setUploading(true);
    
    try {
      const res = await fetch(`/api/exams/${examSelect}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: uploadResult.questions }),
      });
      const result = await res.json();
      
      if (result.success) {
        setUploadDialogOpen(false);
        setExamSelect('');
        setUploadResult(null);
        setUploadError('');
        alert(`成功添加 ${result.data.length} 道题目！`);
        loadExams();
      } else {
        alert(result.error);
      }
    } catch {
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };
  
  // 删除试卷
  const handleDeleteExam = async (id: string) => {
    if (!confirm('确定要删除这个试卷吗？')) return;
    
    try {
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      const result = await res.json();
      
      if (result.success) {
        loadExams();
      }
    } catch (error) {
      console.error('删除试卷失败:', error);
    }
  };
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* 头部 */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">在线考试系统</h1>
                <p className="text-sm text-slate-500">上传试卷 · 在线答题 · 自动评分</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* 隐藏首页的创建试卷按钮 - 仅在管理后台显示 */}
              {/* 
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    创建试卷
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建新试卷</DialogTitle>
                    <DialogDescription>填写试卷基本信息</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">试卷标题</Label>
                      <Input
                        id="title"
                        placeholder="例如：2024年期末考试"
                        value={newExam.title}
                        onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">试卷描述</Label>
                      <Textarea
                        id="description"
                        placeholder="试卷说明..."
                        value={newExam.description}
                        onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalScore">总分</Label>
                      <Input
                        id="totalScore"
                        type="number"
                        value={newExam.totalScore}
                        onChange={(e) => setNewExam({ ...newExam, totalScore: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
                    <Button onClick={handleCreateExam}>创建</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              */}
              
              {/* 隐藏首页的上传试卷按钮 - 仅在管理后台显示 */}
              {/* 
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    上传试卷
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>上传试卷文件</DialogTitle>
                    <DialogDescription>支持 docx、pdf、txt、md 格式的文件</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>选择目标试卷</Label>
                      <Select value={examSelect} onValueChange={setExamSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择要添加题目的试卷" />
                        </SelectTrigger>
                        <SelectContent>
                          {exams.map((exam) => (
                            <SelectItem key={exam.id} value={exam.id}>
                              {exam.title} ({exam.questions?.[0]?.count || 0} 题)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>上传试卷文件</Label>
                      <div 
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                          dragOver 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-slate-300 hover:border-blue-400'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".docx,.pdf,.txt,.md"
                          className="hidden"
                          onChange={onFileChange}
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-2" />
                            <p className="text-slate-600">正在解析文件...</p>
                          </div>
                        ) : uploadResult ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle className="w-12 h-12 text-green-600 mb-2" />
                            <p className="text-green-600 font-medium">文件解析成功</p>
                            <p className="text-sm text-slate-500 mt-1">{uploadResult.fileName}</p>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                            <p className="text-slate-600">点击或拖拽文件到此处上传</p>
                            <p className="text-sm text-slate-400 mt-1">支持 .docx、.pdf、.txt、.md 格式</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {uploadError && (
                      <Alert variant="destructive">
                        <AlertTitle>上传失败</AlertTitle>
                        <AlertDescription>{uploadError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {uploadResult && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">
                              解析成功！共识别 {uploadResult.questionCount} 道题目
                            </span>
                          </div>
                        </div>
                        
                        {uploadResult.questionCount > 0 ? (
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {uploadResult.questions.slice(0, 10).map((q, index) => {
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
                              return (
                                <div key={index} className="p-3 bg-slate-50 rounded-lg text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded ${typeColors[q.type] || 'bg-slate-100'}`}>
                                      {typeLabels[q.type] || q.type}
                                    </span>
                                    <span className="text-slate-500">{q.score}分</span>
                                  </div>
                                  <p className="text-slate-700 line-clamp-2">{q.content}</p>
                                </div>
                              );
                            })}
                            {uploadResult.questionCount > 10 && (
                              <p className="text-sm text-slate-500 text-center">
                                还有 {uploadResult.questionCount - 10} 道题目...
                              </p>
                            )}
                          </div>
                        ) : (
                          <Alert>
                            <AlertTitle>未识别到题目</AlertTitle>
                            <AlertDescription>
                              <p className="mt-1">请确保文件格式正确，参考下方格式说明。</p>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                    
                    <Alert>
                      <AlertTitle>文件格式说明</AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-2 text-sm">
                          <p><strong>单选题格式：</strong></p>
                          <code className="block bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                            [choice] 题目内容 | A. 选项1 | B. 选项2 | C. 选项3 | D. 选项4 | 答案:B | 分值:5
                          </code>
                          <p><strong>多选题格式：</strong></p>
                          <code className="block bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                            [multi] 题目内容 | A. 选项1 | B. 选项2 | C. 选项3 | D. 选项4 | 答案:ABC | 分值:5
                          </code>
                          <p><strong>判断题格式：</strong></p>
                          <code className="block bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                            [judge] 题目内容 | 答案:对 | 分值:5
                          </code>
                          <p><strong>填空题格式：</strong></p>
                          <code className="block bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                            [blank] 题目内容__ | 答案:正确答案 | 分值:5
                          </code>
                          <p><strong>问答题格式：</strong></p>
                          <code className="block bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                            [essay] 题目内容 | 答案:参考答案 | 分值:10
                          </code>
                          <p className="mt-2 text-slate-500">
                            每行一个题目，使用 | 分隔各部分。
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setUploadDialogOpen(false);
                      setUploadResult(null);
                      setUploadError('');
                      setExamSelect('');
                    }}>取消</Button>
                    <Button 
                      onClick={handleConfirmUpload} 
                      disabled={!examSelect || !uploadResult || uploadResult.questionCount === 0 || uploading}
                    >
                      {uploading ? '上传中...' : `确认添加 ${uploadResult?.questionCount || 0} 道题目`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              */}
              
              <Link href="/admin">
                <Button variant="ghost">
                  <Lock className="w-4 h-4 mr-2" />
                  管理后台
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      {/* 试卷列表 */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : exams.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">暂无试卷</h3>
              <p className="text-slate-500 mb-4">点击上方按钮创建第一个试卷</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{exam.title}</CardTitle>
                      {exam.description && (
                        <CardDescription className="mt-2 line-clamp-2">
                          {exam.description}
                        </CardDescription>
                      )}
                    </div>
                    {/* 隐藏首页的删除试卷按钮 - 仅在管理后台显示 */}
                    {/* 
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExam(exam.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    */}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {exam.questions?.[0]?.count || 0} 题
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(exam.created_at)}
                    </div>
                    <Badge variant="secondary">
                      满分 {exam.total_score}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Link href={`/exam/${exam.id}`} className="flex-1">
                    <Button className="w-full" disabled={!exam.questions || exam.questions.length === 0 || !exam.questions[0]?.count}>
                      <Play className="w-4 h-4 mr-2" />
                      开始答题
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="border-t bg-slate-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">在线考试系统</p>
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                <Lock className="w-3 h-3 mr-1" />
                管理后台
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
