import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  JuryBossId,
  EvaluationPreset,
  CrossGroundingContext,
} from '@pitcharena/shared';
import {
  BOSS_PERSONAS,
  buildQuestionPrompt,
} from './prompt-templates';

describe('Phase 6: Jury Cross-Grounding Prompt Templates', () => {
  const boss = BOSS_PERSONAS[JuryBossId.FINANCE_DRAGON];
  const ragContext = `[MÔ HÌNH KINH DOANH]: Giá bán 15 triệu VNĐ/tháng, CAC 3.2 triệu VNĐ.`;

  it('phải tạo prompt cơ bản theo Word khi không có CrossGroundingContext (Graceful Fallback)', () => {
    const prompt = buildQuestionPrompt(
      boss,
      ragContext,
      'Thí sinh hoàn tất bài thuyết trình',
      false,
      undefined,
      EvaluationPreset.SV_STARTUP
    );

    assert.ok(prompt.includes('GS. Vũ Hoàng'));
    assert.ok(prompt.includes(ragContext));
    assert.ok(!prompt.includes('CHIẾN LƯỢC ĐỐI CHIẾU MÂU THUẪN PITCH vs WORD'));
  });

  it('phải tiêm chỉ thị đối chiếu chéo khi có node đính chính (Pitch-First Confrontation)', () => {
    const crossGroundingContext: CrossGroundingContext = {
      refinedNodes: [
        {
          key: 'Chỉ số CAC thực tế',
          value: '4.8 triệu VNĐ (đã điều chỉnh tăng do kênh quảng cáo)',
          sectionType: 'BUSINESS_MODEL_UNIT_ECONOMICS',
        },
      ],
      isPivotDetected: false,
    };

    const prompt = buildQuestionPrompt(
      boss,
      ragContext,
      'Tôi muốn đính chính chỉ số CAC là 4.8 triệu.',
      false,
      undefined,
      EvaluationPreset.SV_STARTUP,
      [],
      crossGroundingContext
    );

    assert.ok(prompt.includes('CHIẾN LƯỢC ĐỐI CHIẾU MÂU THUẪN PITCH vs WORD'));
    assert.ok(prompt.includes('CÁC ĐIỂM ĐÍNH CHÍNH / THAY ĐỔI TRỰC TIẾP SO VỚI BẢN WORD'));
    assert.ok(prompt.includes('4.8 triệu VNĐ'));
    assert.ok(prompt.includes('TUYỆT ĐỐI KHÔNG trích xuất câu hỏi từ các số liệu cũ'));
  });

  it('phải tiêm chỉ thị truy vấn Khối 6 khi có Section 6 Nodes phát sinh', () => {
    const crossGroundingContext: CrossGroundingContext = {
      section6Title: 'Mở rộng dịch vụ Telemedicine tại nhà',
      section6Nodes: [
        {
          key: 'Gói khám Telemedicine VIP',
          value: 'Cung cấp dịch vụ xét nghiệm máu tận nơi với chi phí 500,000 VNĐ',
          sectionType: 'DYNAMIC_EXPANDED_SCOPE',
        },
      ],
      isPivotDetected: false,
    };

    const prompt = buildQuestionPrompt(
      boss,
      ragContext,
      'Chúng tôi bổ sung thêm dịch vụ Telemedicine tại nhà.',
      false,
      undefined,
      EvaluationPreset.SV_STARTUP,
      [],
      crossGroundingContext
    );

    assert.ok(prompt.includes('KHỐI 6 PHÁT SINH MỚI NGOÀI BẢN WORD'));
    assert.ok(prompt.includes('Mở rộng dịch vụ Telemedicine tại nhà'));
    assert.ok(prompt.includes('Gói khám Telemedicine VIP'));
    assert.ok(prompt.includes('truy vấn cơ sở khả thi và nguồn lực để triển khai'));
  });

  it('phải kích hoạt cờ Bẻ lái Đề án (MAJOR PROPOSAL PIVOT) khi isPivotDetected = true', () => {
    const crossGroundingContext: CrossGroundingContext = {
      isPivotDetected: true,
      refinedNodes: [],
      section6Nodes: [],
    };

    const prompt = buildQuestionPrompt(
      boss,
      ragContext,
      'Chúng tôi quyết định bỏ hoàn toàn B2B sang làm B2C.',
      false,
      undefined,
      EvaluationPreset.SV_STARTUP,
      [],
      crossGroundingContext
    );

    assert.ok(prompt.includes('[CỜ BẺ LÁI ĐỀ ÁN: MAJOR PROPOSAL PIVOT]'));
    assert.ok(prompt.includes('CHỈ THỊ MỞ MÀN: Hãy ưu tiên chất vấn trực diện ngay vào việc tại sao nhóm lại thay đổi định hướng'));
  });

  it('phải tiêm chỉ thị chống lặp ý sâu sắc khi có danh sách resolvedQAPairs', () => {
    const resolvedQAPairs = [
      {
        bossName: 'GS. Vũ Hoàng',
        question: 'Chi phí máy chủ và vận hành hàng tháng của nhóm là bao nhiêu?',
        candidateAnswer: 'Dạ chi phí máy chủ là 5 triệu/tháng và nhóm có quỹ dự phòng 30 triệu từ giải thưởng NCKH.',
      },
    ];

    const prompt = buildQuestionPrompt(
      boss,
      ragContext,
      'Thí sinh phản biện vòng trước',
      false,
      undefined,
      EvaluationPreset.SV_STARTUP,
      ['Chi phí máy chủ là bao nhiêu?'],
      undefined,
      resolvedQAPairs
    );

    assert.ok(prompt.includes('CÁC NỘI DUNG VÀ CÂU HỎI ĐÃ ĐƯỢC THÍ SINH GIẢI TRÌNH XONG'));
    assert.ok(prompt.includes('GS. Vũ Hoàng chất vấn'));
    assert.ok(prompt.includes('5 triệu/tháng và nhóm có quỹ dự phòng 30 triệu'));
    assert.ok(prompt.includes('CHỈ THỊ BẮT BUỘC VỀ TÍNH MỚI & CHỦ ĐỀ'));
    assert.ok(prompt.includes('chuyển sang một khía cạnh hoặc chủ đề hoàn toàn mới'));
  });
});
