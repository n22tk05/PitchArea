import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { JuryBossId } from '@pitcharena/shared';
import { FollowUpEngine } from './follow-up-engine';

describe('FollowUpEngine - Topic Registry & Cumulative Burn-Down', () => {
  it('ngân hàng chủ đề phải có đúng 8 chủ đề chính cho mỗi Boss (tổng 32 chủ đề)', () => {
    for (const bossId of Object.values(JuryBossId)) {
      const topics = FollowUpEngine.TOPIC_REGISTRY[bossId];
      assert.strictEqual(topics.length, 8, `Boss ${bossId} phải có đúng 8 chủ đề`);
      topics.forEach((t) => {
        assert.ok(t.id && t.id.length > 0, 'Chủ đề phải có id');
        assert.ok(t.name && t.name.length > 0, 'Chủ đề phải có name');
        assert.ok(t.focus && t.focus.length > 0, 'Chủ đề phải có focus');
        assert.ok(t.sectionTarget, 'Chủ đề phải có sectionTarget');
      });
    }
  });

  it('getTopicForBoss phải lọc bỏ 100% các chủ đề đã có trong usedTopicIds', () => {
    const engine = new FollowUpEngine();
    const bossId = JuryBossId.MARKET_SHARK;
    const allTopics = FollowUpEngine.TOPIC_REGISTRY[bossId];

    // Đánh dấu 7 chủ đề đầu tiên là đã dùng
    const usedIds = allTopics.slice(0, 7).map((t) => t.id);
    const lastTopic = allTopics[7];

    // Kết quả bắt buộc phải là chủ đề duy nhất còn lại
    const result = engine.getTopicForBoss(bossId, usedIds);
    assert.strictEqual(result.topicId, lastTopic.id);
    assert.strictEqual(result.topic, lastTopic.name);
  });

  it('khi 8 chủ đề chính cạn kiệt, phải kích hoạt Stress-Test Inversion mượt mà', () => {
    const engine = new FollowUpEngine();
    const bossId = JuryBossId.TECH_SENTINEL;
    const allTopics = FollowUpEngine.TOPIC_REGISTRY[bossId];

    // Đốt sạch 8 chủ đề chính
    const usedIds = allTopics.map((t) => t.id);

    const result = engine.getTopicForBoss(bossId, usedIds);
    const stressTopics = FollowUpEngine.STRESS_TEST_TOPICS[bossId].map((t) => t.id);

    assert.ok(
      stressTopics.includes(result.topicId),
      `Topic ID ${result.topicId} phải thuộc nhóm Stress-Test Inversion`
    );
    assert.ok(result.topic.includes('Thử thách nghịch đảo'));
  });

  it('decideNextMove phải luân chuyển chủ đề mới và ghi nhận topicId', () => {
    const engine = new FollowUpEngine();
    const evaluation = {
      isVague: false,
      isDefensive: false,
      hasNumbers: true,
      wordCount: 40,
    };

    const usedTopicIds = ['mkt_old_habit', 'tech_data_flow'];

    const decision = engine.decideNextMove(
      0,
      'So sánh với cách làm truyền thống',
      evaluation,
      JuryBossId.MARKET_SHARK,
      [JuryBossId.MARKET_SHARK, JuryBossId.TECH_SENTINEL],
      false,
      undefined,
      usedTopicIds
    );

    assert.strictEqual(decision.action, 'NEW_QUESTION');
    assert.strictEqual(decision.suggestedBossId, JuryBossId.TECH_SENTINEL);
    assert.ok(decision.topicId, 'Decision phải có topicId');
    assert.notStrictEqual(decision.topicId, 'tech_data_flow', 'Không được bốc lại topic đã cháy');
  });
});
