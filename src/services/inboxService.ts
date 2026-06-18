import type { Career, InboxEvent, InboxEventType } from '../types/career'

export function addEvent(
  type: InboxEventType,
  title: string,
  body: string,
  career: Career,
  data?: Record<string, unknown>,
  targetScreen?: string,
  targetEntityId?: string,
): Career {
  const event: InboxEvent = {
    id: crypto.randomUUID(),
    type,
    title,
    body,
    date: new Date().toISOString().split('T')[0],
    read: false,
    data,
    targetScreen,
    targetEntityId,
  }

  return {
    ...career,
    inbox: [event, ...career.inbox],
  }
}

export function markRead(eventId: string, career: Career): Career {
  return {
    ...career,
    inbox: career.inbox.map((e) =>
      e.id === eventId ? { ...e, read: true } : e,
    ),
  }
}

export function markAllRead(career: Career): Career {
  return {
    ...career,
    inbox: career.inbox.map((e) => ({ ...e, read: true })),
  }
}

export function getUnreadCount(career: Career): number {
  return career.inbox.filter((e) => !e.read).length
}
