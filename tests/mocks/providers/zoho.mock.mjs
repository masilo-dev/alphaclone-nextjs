/** Opt-in Zoho Mail mock payloads for staging integration tests. */
export function mockZohoFolders() {
  return [
    { folderId: 'inbox', folderName: 'Inbox' },
    { folderId: 'sent', folderName: 'Sent' },
  ];
}

export function mockZohoMessages(folderId = 'inbox') {
  return [
    {
      messageId: 'msg-1',
      folderId,
      subject: 'Mock message',
      fromAddress: 'sender@example.com',
    },
  ];
}
