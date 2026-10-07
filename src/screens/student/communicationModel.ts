import { ParentMessage } from '../../api/student';
import { displayDate } from '../../utils/dates';
import { cleanText } from './listHelpers';

export interface MessageRow {
  key: string;
  title: string;
  message: string;
  sentOn: string;
  hasReply: boolean;
  reply: string;
  replyBy: string;
  replyOn: string;
}

/** Server order (it sends newest first). A reply of "null" or blank means the school has not replied yet. */
export function messageRows(items: ParentMessage[]): MessageRow[] {
  return items.map((m, i) => {
    const reply = cleanText(m.reply);
    return {
      key: `${i}`,
      title: cleanText(m.title) || 'Message',
      message: m.message.trim(),
      sentOn: displayDate(m.createdAt),
      hasReply: reply !== '',
      reply,
      replyBy: cleanText(m.replyBy),
      replyOn: displayDate(m.replyOn),
    };
  });
}
