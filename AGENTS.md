# 在线考试系统

## 项目概述

基于 Next.js 16 + Supabase 的在线考试系统，支持试卷上传、在线答题、自动评分和管理后台。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **数据库**: Supabase (PostgreSQL)
- **UI组件**: shadcn/ui
- **样式**: Tailwind CSS 4

## 功能特性

### 1. 试卷管理
- 创建试卷（标题、描述、总分）
- 上传题目（支持 docx、pdf、txt、md 格式）
- 支持五种题型：单选题、多选题、判断题、填空题、问答题
- 删除试卷

### 2. 在线答题
- 答题前需填写学员姓名
- 题目导航（上一题、下一题）
- 答题状态跟踪
- 题目导航面板
- 提交前确认

### 3. 自动评分
- 客观题（单选、多选、判断、填空）自动评分
- 问答题默认满分（待人工评分后确认）
- 显示得分、正确率、各题型得分统计
- 优秀/良好/及格/不及格评级

### 4. 管理后台
- 统计数据概览（试卷数、提交人次、平均分、及格率）
- 成绩列表（支持按试卷筛选、按姓名搜索、按分数/时间排序）
- 显示学员排名
- 试卷管理

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/exams` | GET | 获取所有试卷 |
| `/api/exams` | POST | 创建试卷 |
| `/api/exams/[id]` | GET | 获取试卷详情 |
| `/api/exams/[id]` | PUT | 更新试卷 |
| `/api/exams/[id]` | DELETE | 删除试卷 |
| `/api/exams/[id]/questions` | GET | 获取题目列表 |
| `/api/exams/[id]/questions` | POST | 批量添加题目 |
| `/api/submissions` | POST | 提交答案（自动评分） |
| `/api/scores` | GET | 获取成绩列表（支持 examId、studentName、sortBy 参数） |
| `/api/upload` | POST | 上传并解析试卷文件 |

## 数据表结构

- **exams**: 试卷表
- **questions**: 题目表
- **submissions**: 提交记录表
- **answers**: 答案表

## 开发命令

```bash
pnpm install    # 安装依赖
pnpm dev        # 开发环境
pnpm build      # 构建生产版本
pnpm start      # 启动生产服务
pnpm ts-check   # TypeScript 类型检查
pnpm lint       # ESLint 检查
```

## 题目格式说明

### 文件格式（上传时使用）

支持 txt、md、docx、pdf 格式，每行一个题目，使用 `|` 分隔各部分。

#### 单选题格式
```
[choice] 题目内容 | A. 选项1 | B. 选项2 | C. 选项3 | D. 选项4 | 答案:B | 分值:5
```

#### 多选题格式
```
[multi] 题目内容 | A. 选项1 | B. 选项2 | C. 选项3 | D. 选项4 | 答案:ABC | 分值:10
```

#### 判断题格式
```
[judge] 题目内容 | 答案:对 | 分值:5
[judge] 题目内容 | 答案:错 | 分值:5
```

#### 填空题格式
```
[blank] 题目内容__ | 答案:正确答案 | 分值:5
```

#### 问答题格式
```
[essay] 题目内容 | 答案:参考答案 | 分值:15
```

### JSON 格式（API 直接提交）

```json
[
  {
    "type": "choice",
    "content": "题目内容",
    "options": [
      {"label": "A", "content": "选项A"},
      {"label": "B", "content": "选项B"},
      {"label": "C", "content": "选项C"},
      {"label": "D", "content": "选项D"}
    ],
    "correctAnswer": "B",
    "score": 5
  },
  {
    "type": "multi",
    "content": "题目内容",
    "options": [
      {"label": "A", "content": "选项A"},
      {"label": "B", "content": "选项B"},
      {"label": "C", "content": "选项C"},
      {"label": "D", "content": "选项D"}
    ],
    "correctAnswer": "ABC",
    "score": 10
  },
  {
    "type": "judge",
    "content": "题目内容",
    "correctAnswer": "T",
    "score": 5
  },
  {
    "type": "blank",
    "content": "填空题内容__",
    "correctAnswer": "答案",
    "score": 5
  },
  {
    "type": "essay",
    "content": "问答题内容",
    "correctAnswer": "参考答案",
    "score": 15
  }
]
```

### 判断题答案说明

| 用户输入 | 系统识别 | 正确 |
|----------|----------|------|
| T, true, 对, 正确, √, yes, Y, 1 | 正确 | T |
| F, false, 错, 错误, ×, no, N, 0 | 错误 | F |

### 填空题答案说明

- 多个正确答案可用 `/` 分隔，如：`答案:1839/1837/1838`

## 评分规则

| 题型 | 评分方式 | 说明 |
|------|----------|------|
| 单选题 | 自动评分 | 答案完全匹配得分 |
| 多选题 | 自动评分 | 选项完全匹配得分（顺序无关） |
| 判断题 | 自动评分 | T/对/正确 匹配 T，F/错/错误 匹配 F |
| 填空题 | 自动评分 | 忽略大小写，支持多个正确答案 |
| 问答题 | 待人工评分 | 默认满分，实际分数需人工确认 |
