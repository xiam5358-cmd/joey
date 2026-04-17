import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取指定试卷
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('exams')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw new Error(`查询试卷失败: ${error.message}`);
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: '试卷不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 更新试卷
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('exams')
      .update({
        title: body.title,
        description: body.description,
        total_score: body.totalScore || body.total_score,
        is_hidden: body.isHidden !== undefined ? body.isHidden : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`更新试卷失败: ${error.message}`);
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 删除试卷
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    const { error } = await client
      .from('exams')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(`删除试卷失败: ${error.message}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
