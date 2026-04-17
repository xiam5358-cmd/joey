import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface AnswerItem {
  is_correct: boolean;
}

interface SubmissionRecord {
  id: string;
  exam_id: string;
  student_name: string;
  total_score: number;
  submitted_at: string;
  exam: {
    id: string;
    title: string;
    total_score: number;
  };
  answers: AnswerItem[];
}

// 获取成绩列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const studentName = searchParams.get('studentName');
    const sortBy = searchParams.get('sortBy') || 'submitted_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const client = getSupabaseClient();
    
    // 构建查询
    let query = client
      .from('submissions')
      .select(`
        *,
        exam:exams(id, title, total_score)
      `)
      .eq('status', 'scored');
    
    if (examId) {
      query = query.eq('exam_id', examId);
    }
    
    if (studentName) {
      query = query.ilike('student_name', `%${studentName}%`);
    }
    
    // 排序
    if (sortBy === 'score') {
      query = query.order('total_score', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('submitted_at', { ascending: sortOrder === 'asc' });
    }
    
    const { data: submissions, error } = await query;
    
    if (error) throw new Error(`查询成绩失败: ${error.message}`);
    
    // 获取每个提交记录的答案统计
    const formattedData = await Promise.all(
      (submissions || []).map(async (submission: SubmissionRecord) => {
        // 获取该提交的所有答案
        const { data: answers, error: answersError } = await client
          .from('answers')
          .select('is_correct')
          .eq('submission_id', submission.id);
        
        if (answersError) {
          return {
            ...submission,
            correctCount: 0,
            totalCount: 0,
            accuracy: 0,
          };
        }
        
        const correctCount = (answers || []).filter((a) => a.is_correct).length;
        const totalCount = (answers || []).length;
        const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        
        return {
          ...submission,
          correctCount,
          totalCount,
          accuracy,
        };
      })
    );
    
    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 删除成绩记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scoreId = searchParams.get('id');
    
    if (!scoreId) {
      return NextResponse.json(
        { success: false, error: '缺少成绩记录ID' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 先删除该提交的所有答案
    const { error: answersError } = await client
      .from('answers')
      .delete()
      .eq('submission_id', scoreId);
    
    if (answersError) {
      console.error('删除答案失败:', answersError);
    }
    
    // 再删除提交记录
    const { error: submissionError } = await client
      .from('submissions')
      .delete()
      .eq('id', scoreId);
    
    if (submissionError) {
      throw new Error(`删除成绩记录失败: ${submissionError.message}`);
    }
    
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
