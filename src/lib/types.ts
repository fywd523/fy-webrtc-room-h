export interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isSharingScreen?: boolean;
  joinTime: string; // 添加加入时间字段（ISO格式字符串）
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isLocal: boolean;
}
