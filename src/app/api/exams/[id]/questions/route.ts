import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface QuestionInput {
  type?: string;
  content: string;
  options?: unknown[];
  correctAnswer?: string;
  correct_answer?: string;
  score?: number;
  orderIndex?: number;
  order_index?: number;
}

// 获取指定试卷的题目
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('questions')
      .select('*')
      .eq('exam_id', id)
      .order('order_index', { ascending: true });
    
    if (error) throw new Error(`查询题目失败: ${error.message}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 批量添加题目
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const body = await request.json();
    
    if (!Array.isArray(body.questions)) {
      return NextResponse.json(
        { success: false, error: 'questions 必须是数组' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 批量插入题目
    const questionsWithExamId = body.questions.map((q: QuestionInput, index: number) => ({
      exam_id: examId,
      type: q.type || 'choice',
      content: q.content,
      options: q.options ? JSON.stringify(q.options) : null,
      correct_answer: q.correctAnswer || q.correct_answer,
      score: q.score || 5,
      order_index: q.orderIndex ?? q.order_index ?? index,
    }));
    
    const { data, error } = await client
      .from('questions')
      .insert(questionsWithExamId)
      .select();
    
    if (error) throw new Error(`添加题目失败: ${error.message}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 删除试卷的指定题目
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    
    if (!questionId) {
      return NextResponse.json(
        { success: false, error: '缺少 questionId 参数' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    const { error } = await client
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('exam_id', id);
    
    if (error) throw new Error(`删除题目失败: ${error.message}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
