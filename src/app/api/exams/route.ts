import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { insertExamSchema } from '@/storage/database/shared/schema';

// 获取所有试卷（学员端只显示未隐藏的试卷）
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get('admin') === 'true';
    
    // 非管理员不显示隐藏试卷
    let query = client
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!isAdmin) {
      query = query.eq('is_hidden', false);
    }
    
    const { data, error } = await query;
    
    if (error) throw new Error(`查询试卷失败: ${error.message}`);
    
    // 获取每个试卷的题目数量
    const examsWithCount = await Promise.all(
      (data || []).map(async (exam: { id: string }) => {
        const { count } = await client
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('exam_id', exam.id);
        return { ...exam, questions: [{ count: count || 0 }] };
      })
    );
    
    return NextResponse.json({ success: true, data: examsWithCount });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 创建试卷
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = insertExamSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: '数据格式错误', details: parseResult.error.issues },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('exams')
      .insert(parseResult.data)
      .select()
      .single();
    
    if (error) throw new Error(`创建试卷失败: ${error.message}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
