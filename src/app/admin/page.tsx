'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Users, BarChart3, RefreshCw, TrendingUp, CheckCircle2, XCircle, Search, Trophy, Lock, ShieldCheck, Plus, Upload, UploadCloud, File, CheckCircle, Loader2, Trash2, FileText, Eye, EyeOff } from 'lucide-react';

const ADMIN_PASSWORD = 'jdys8888';

interface ParsedQuestion {
  type: string;
  content: string;
  options?: { label: string; content: string }[];
  correctAnswer: string;
  score: number;
}

interface Exam {
  id: string;
  title: string;
  description: string;
  total_score: number;
  is_hidden?: boolean;
  created_at: string;
}

interface ScoreRecord {
  id: string;
  student_name: string;
  total_score: number;
  submitted_at: string;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  exam: {
    id: string;
    title: string;
    total_score: number;
  };
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [searchName, setSearchName] = useState('');
  const [sortBy, setSortBy] = useState<'submitted_at' | 'score'>('submitted_at');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 创建试卷相关状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newExam, setNewExam] = useState({ title: '', description: '', totalScore: 100 });
  
  // 上传试卷相关状态
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [examSelect, setExamSelect] = useState('');
  const [uploadResult, setUploadResult] = useState<{ fileName: string; questionCount: number; questions: ParsedQuestion[] } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 统计数据
  const [stats, setStats] = useState({
    totalExams: 0,
    totalSubmissions: 0,
    avgScore: 0,
    passRate: 0,
  });

  // 检查是否已验证
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated');
    setIsAuthenticated(auth === 'true');
  }, []);

  // 密码验证
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('密码错误，请重试');
      setPassword('');
    }
  };

  // 登出
  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setPassword('');
  };
  
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
        loadData();
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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) {
        setUploadResult(result.data);
      } else {
        setUploadError(result.error);
      }
    } catch {
      setUploadError('文件上传失败');
    } finally {
      setUploading(false);
    }
  };
  
  // 确认上传
  const handleConfirmUpload = async () => {
    if (!examSelect || !uploadResult) return;
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
        setUploadResult(null);
        setUploadError('');
        setExamSelect('');
        loadData();
        alert(`成功添加 ${uploadResult.questionCount} 道题目`);
      } else {
        alert(result.error);
      }
    } catch {
      alert('上传失败');
    } finally {
      setUploading(false);
    }
  };
  
  // 删除试卷
  const handleDeleteExam = async (examId: string) => {
    if (!confirm('确定要删除这个试卷吗？所有相关成绩也会被删除。')) return;
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        loadData();
      } else {
        alert(result.error);
      }
    } catch {
      alert('删除失败');
    }
  };
  
  // 切换试卷隐藏状态
  const handleToggleHidden = async (examId: string, currentHidden: boolean) => {
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: !currentHidden }),
      });
      const result = await res.json();
      if (result.success) {
        loadData();
      } else {
        alert(result.error);
      }
    } catch {
      alert('操作失败');
    }
  };
  
  // 删除成绩记录
  const handleDeleteScore = async (scoreId: string) => {
    if (!confirm('确定要删除这条成绩记录吗？')) return;
    try {
      const res = await fetch(`/api/scores?id=${scoreId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        loadData();
      } else {
        alert(result.error);
      }
    } catch {
      alert('删除失败');
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
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };
  
  // 加载数据
  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedExam !== 'all') params.set('examId', selectedExam);
      if (searchName) params.set('studentName', searchName);
      params.set('sortBy', sortBy);
      
      const [examsRes, scoresRes] = await Promise.all([
        fetch('/api/exams?admin=true'),
        fetch(`/api/scores?${params.toString()}`),
      ]);
      
      const examsData = await examsRes.json();
      const scoresData = await scoresRes.json();
      
      if (examsData.success) {
        setExams(examsData.data);
      }
      
      if (scoresData.success) {
        setScores(scoresData.data);
        
        // 计算统计
        const totalSubmissions = scoresData.data.length;
        const avgScore = totalSubmissions > 0
          ? Math.round(scoresData.data.reduce((sum: number, s: ScoreRecord) => sum + (s.total_score || 0), 0) / totalSubmissions)
          : 0;
        const passCount = scoresData.data.filter((s: ScoreRecord) => s.accuracy >= 60).length;
        const passRate = totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0;
        
        setStats({
          totalExams: examsData.data?.length || 0,
          totalSubmissions,
          avgScore,
          passRate,
        });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [selectedExam, sortBy, isAuthenticated]);

  // 加载数据结束时

  // 密码验证界面
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">管理后台</CardTitle>
            <CardDescription>请输入管理员密码访问</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="输入管理员密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={!password}>
                进入后台
              </Button>
              <div className="text-center">
                <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
                  返回首页
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSearch = () => {
    setLoading(true);
    loadData();
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getGrade = (accuracy: number) => {
    if (accuracy >= 90) return { label: '优秀', color: 'text-green-600 bg-green-100' };
    if (accuracy >= 80) return { label: '良好', color: 'text-blue-600 bg-blue-100' };
    if (accuracy >= 60) return { label: '及格', color: 'text-yellow-600 bg-yellow-100' };
    return { label: '不及格', color: 'text-red-600 bg-red-100' };
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 头部 */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">管理后台</h1>
                <p className="text-sm text-slate-500">实时查看考试数据</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 创建试卷 */}
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
              
              {/* 上传试卷 */}
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
                              {exam.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>上传试卷文件</Label>
                      <div 
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                          dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
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
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
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
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">识别到 {uploadResult.questionCount} 道题目</span>
                          <span className="text-xs text-slate-400">预览前10道</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-3">
                          {uploadResult.questions.slice(0, 10).map((q, index) => (
                            <div key={index} className="p-3 bg-slate-50 rounded-lg text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {q.type === 'choice' ? '单选' : 
                                   q.type === 'multi' ? '多选' : 
                                   q.type === 'judge' ? '判断' : 
                                   q.type === 'blank' ? '填空' : '问答'}
                                </span>
                                <span className="text-slate-500">{q.score}分</span>
                                {q.options && (
                                  <span className="text-slate-400">{q.options.length}个选项</span>
                                )}
                              </div>
                              <p className="text-slate-700 line-clamp-2">{q.content}</p>
                              <p className="text-xs text-green-600 mt-1">
                                答案: {q.correctAnswer || '(待设置)'}
                              </p>
                            </div>
                          ))}
                          {uploadResult.questionCount > 10 && (
                            <p className="text-sm text-slate-500 text-center py-2">
                              ... 还有 {uploadResult.questionCount - 10} 道题目
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setUploadDialogOpen(false);
                      setUploadResult(null);
                      setUploadError('');
                      setExamSelect('');
                    }}>取消</Button>
                    <Button onClick={handleConfirmUpload} disabled={!examSelect || !uploadResult || uploadResult.questionCount === 0 || uploading}>
                      {uploading ? '上传中...' : `确认添加 ${uploadResult?.questionCount || 0} 道题目`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                刷新数据
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm">
                <Lock className="w-4 h-4 mr-2" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {/* 统计卡片 */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">试卷总数</CardTitle>
              <BarChart3 className="w-5 h-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalExams}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">提交人次</CardTitle>
              <Users className="w-5 h-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalSubmissions}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">平均得分</CardTitle>
              <TrendingUp className="w-5 h-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgScore}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">及格率</CardTitle>
              <CheckCircle2 className="w-5 h-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.passRate}%</div>
            </CardContent>
          </Card>
        </div>
        
        {/* 成绩列表 */}
        <Tabs defaultValue="scores" className="space-y-6">
          <TabsList>
            <TabsTrigger value="scores">成绩列表</TabsTrigger>
            <TabsTrigger value="exams">试卷管理</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scores">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>成绩记录</CardTitle>
                    <CardDescription>查看所有学生的考试得分</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="搜索学员姓名"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-40"
                      />
                      <Button variant="outline" size="icon" onClick={handleSearch}>
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="筛选试卷" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部试卷</SelectItem>
                        {exams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'submitted_at' | 'score')}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="排序" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted_at">按时间</SelectItem>
                        <SelectItem value="score">按分数</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : scores.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>暂无成绩记录</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">排名</TableHead>
                        <TableHead>学生姓名</TableHead>
                        <TableHead>试卷</TableHead>
                        <TableHead>得分</TableHead>
                        <TableHead>正确率</TableHead>
                        <TableHead>等级</TableHead>
                        <TableHead>提交时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scores.map((score, index) => {
                        const grade = getGrade(score.accuracy);
                        const isTop3 = index < 3 && sortBy === 'score';
                        return (
                          <TableRow key={score.id} className={isTop3 ? 'bg-amber-50' : ''}>
                            <TableCell>
                              {isTop3 ? (
                                <div className="flex items-center gap-1">
                                  <Trophy className={`w-4 h-4 ${
                                    index === 0 ? 'text-yellow-500' : 
                                    index === 1 ? 'text-gray-400' : 
                                    'text-amber-600'
                                  }`} />
                                  <span className="font-bold">{index + 1}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">{index + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{score.student_name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{score.exam?.title || '未知试卷'}</Badge>
                            </TableCell>
                            <TableCell>
                              {score.total_score}
                              <span className="text-slate-400">/{score.exam?.total_score || 100}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      score.accuracy >= 60 ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${score.accuracy}%` }}
                                  />
                                </div>
                                <span>{score.accuracy}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={grade.color}>
                                {score.accuracy >= 60 ? (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1" />
                                )}
                                {grade.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {formatDate(score.submitted_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteScore(score.id)}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="exams">
            <Card>
              <CardHeader>
                <CardTitle>试卷列表</CardTitle>
                <CardDescription>管理所有考试试卷</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : exams.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>暂无试卷</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>试卷名称</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>总分</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">{exam.title}</TableCell>
                          <TableCell className="text-slate-500 max-w-xs truncate">
                            {exam.description || '-'}
                          </TableCell>
                          <TableCell>{exam.total_score}</TableCell>
                          <TableCell className="text-slate-500">
                            {formatDate(exam.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={exam.is_hidden ? "secondary" : "default"}>
                              {exam.is_hidden ? '已隐藏' : '显示中'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/exam/${exam.id}`}>
                                <Button size="sm" variant="outline">
                                  查看
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant={exam.is_hidden ? "default" : "secondary"}
                                onClick={() => handleToggleHidden(exam.id, !!exam.is_hidden)}
                                className={exam.is_hidden ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}
                              >
                                {exam.is_hidden ? (
                                  <>
                                    <Eye className="w-4 h-4 mr-1" />
                                    显示
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-4 h-4 mr-1" />
                                    隐藏
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteExam(exam.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
