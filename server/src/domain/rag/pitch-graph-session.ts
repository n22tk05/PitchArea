import { randomUUID } from 'crypto';
import {
  PitchGraphNode,
  PitchGraphNodeStatus,
  PitchNodeSource,
  PitchSectionType,
  BusinessWhitelistCategory,
  PitchGraphEdge,
  PitchGraphEdgeType,
  RetractionMarkerType,
} from '@pitcharena/shared';

export interface StagingChunkItem {
  id: string;
  sequenceId: number;
  text: string;
  timestamp: number;
  detectedMarkers: RetractionMarkerType[];
  category?: BusinessWhitelistCategory | 'OTHER';
}

/**
 * Quản lý trạng thái và hàng đợi xử lý Promise Queue theo từng phiên thi đấu (AD-1, AD-2)
 */
export class PitchGraphSession {
  public readonly sessionId: string;
  public readonly documentId?: string;

  // Cấu trúc đồ thị In-Memory thuần RAM (Map + Adjacency Edges)
  public readonly nodes: Map<string, PitchGraphNode> = new Map();
  public readonly edges: PitchGraphEdge[] = [];

  // Buffer chứa các phát biểu tạm thời (chờ phân loại hoặc mở rộng Khối 6)
  public readonly stagingBuffer: StagingChunkItem[] = [];

  // Hàng đợi tuần tự theo phiên (FIFO Sequential Promise Queue) triệt tiêu race condition
  private mutationQueue: Promise<void> = Promise.resolve();

  // Trạng thái phiên
  public isFinalized = false;
  public fullRawTranscript = '';
  public durationSeconds = 0;
  public totalChunksCount = 0;
  public lastSequenceId = -1;

  // Metadata của Khối 6 và Pivot Flag
  public hasSection6 = false;
  public section6Title?: string;
  public isPivotDetected = false;

  constructor(sessionId: string, documentId?: string) {
    this.sessionId = sessionId;
    this.documentId = documentId;
  }

  /**
   * Đẩy một thao tác vào hàng đợi tuần tự Promise Queue của Session (AD-2)
   */
  public enqueueMutation<T>(mutationFn: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.mutationQueue = this.mutationQueue
        .then(async () => {
          try {
            const result = await mutationFn();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          // Bảo đảm hàng đợi không bị vỡ/treo khi một thao tác con gặp lỗi
          reject(err);
        });
    });
  }

  /**
   * Thêm mới một Node vào đồ thị
   */
  public addNode(node: PitchGraphNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Tìm Node theo ID
   */
  public getNode(nodeId: string): PitchGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Cập nhật trạng thái Node (VD: SUPERSEDED, RETRACTED)
   */
  public updateNodeStatus(
    nodeId: string,
    status: PitchGraphNodeStatus,
    supersededById?: string
  ): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.status = status;
    if (supersededById) {
      node.supersededById = supersededById;
    }
    return true;
  }

  /**
   * Thêm cạnh quan hệ đồ thị giữa 2 node
   */
  public addEdge(edge: PitchGraphEdge): void {
    this.edges.push(edge);
  }

  /**
   * Lấy danh sách toàn bộ các Node đang có hiệu lực (ACTIVE)
   */
  public getActiveNodes(): PitchGraphNode[] {
    const result: PitchGraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.status === PitchGraphNodeStatus.ACTIVE) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Lấy danh sách các Node tinh chỉnh đè lên bản Word (PITCH_REFINED)
   */
  public getRefinedNodes(): PitchGraphNode[] {
    const result: PitchGraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (
        node.status === PitchGraphNodeStatus.ACTIVE &&
        node.source === PitchNodeSource.PITCH_REFINED
      ) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Tìm Node gần nhất theo điều kiện
   */
  public findMostRecentActiveNode(
    predicate?: (node: PitchGraphNode) => boolean
  ): PitchGraphNode | undefined {
    let mostRecent: PitchGraphNode | undefined;
    for (const node of this.nodes.values()) {
      if (node.status !== PitchGraphNodeStatus.ACTIVE) continue;
      if (predicate && !predicate(node)) continue;

      if (
        !mostRecent ||
        node.sequenceId > mostRecent.sequenceId ||
        (node.sequenceId === mostRecent.sequenceId && node.timestamp >= mostRecent.timestamp)
      ) {
        mostRecent = node;
      }
    }
    return mostRecent;
  }

  /**
   * Thêm phát biểu vào Staging Buffer
   */
  public addStagingItem(item: Omit<StagingChunkItem, 'id'>): StagingChunkItem {
    const stagingItem: StagingChunkItem = {
      id: randomUUID(),
      ...item,
    };
    this.stagingBuffer.push(stagingItem);
    return stagingItem;
  }

  /**
   * Xóa sạch toàn bộ bộ nhớ của session khi kết thúc (C-1: Zero Memory Leak)
   */
  public clear(): void {
    this.nodes.clear();
    this.edges.length = 0;
    this.stagingBuffer.length = 0;
    this.fullRawTranscript = '';
    this.isFinalized = false;
    this.durationSeconds = 0;
    this.totalChunksCount = 0;
    this.lastSequenceId = -1;
    this.hasSection6 = false;
    this.section6Title = undefined;
    this.isPivotDetected = false;
    this.mutationQueue = Promise.resolve();
  }
}
