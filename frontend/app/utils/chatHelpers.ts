function computeConversationId(
  senderType: string | number,
  senderId: string | number,
  receiverType: string | number,
  receiverId: string | number
): string {
  const p1 = `${String(senderType)}:${String(senderId)}`;
  const p2 = `${String(receiverType)}:${String(receiverId)}`;
  return `conv:${[p1, p2].sort().join('_')}`;
}

export default computeConversationId;
