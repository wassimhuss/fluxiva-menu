import type { Language } from './types'
const arabic: Record<string, string> = {
  'Notifications': 'الإشعارات', 'Messages': 'الرسائل', 'Branch requests': 'طلبات الفروع',
  'Notifications and branch requests': 'الإشعارات وطلبات الفروع',
  'Messages from Fluxiva': 'رسائل من فلوكسيفا', 'No messages yet.': 'لا توجد رسائل بعد.',
  'Unread': 'غير مقروءة', 'Read': 'مقروءة', 'Mark as read': 'تحديد كمقروءة',
  'Pending requests': 'طلبات قيد المراجعة', 'Approved branches': 'فروع مقبولة', 'Unread messages': 'رسائل غير مقروءة',
  'Loading notifications…': 'جارٍ تحميل الإشعارات…', 'Could not load notifications.': 'تعذّر تحميل الإشعارات.',
  'Could not mark this message as read.': 'تعذّر تحديد الرسالة كمقروءة.',
  'Refresh': 'تحديث', 'Previous': 'السابق', 'Next': 'التالي', 'Page': 'الصفحة',
  'Send a message to all owners': 'إرسال رسالة إلى جميع أصحاب المطاعم',
  'Messages appear in the dashboard of current owner accounts. No email or WhatsApp is sent.': 'تظهر الرسائل في لوحة تحكم حسابات أصحاب المطاعم الحالية. لا يتم إرسال بريد إلكتروني أو رسالة واتساب.',
  'English title': 'العنوان بالإنجليزية', 'Arabic title': 'العنوان بالعربية',
  'English message': 'الرسالة بالإنجليزية', 'Arabic message': 'الرسالة بالعربية',
  'Review message': 'مراجعة الرسالة', 'Send to all owners?': 'إرسال إلى جميع أصحاب المطاعم؟',
  'Send message': 'إرسال الرسالة', 'Sending…': 'جارٍ الإرسال…', 'Cancel': 'إلغاء',
  'Message sent.': 'تم إرسال الرسالة.', 'Owner accounts notified': 'حسابات أصحاب المطاعم التي تم إشعارها',
  'Sent messages': 'الرسائل المرسلة', 'No sent messages yet.': 'لا توجد رسائل مرسلة بعد.',
  'Recipients': 'المستلمون', 'Read by': 'قرأها', 'Loading messages…': 'جارٍ تحميل الرسائل…',
  'Could not load sent messages.': 'تعذّر تحميل الرسائل المرسلة.',
  'Could not confirm sending. Retry with the same message to avoid duplicates.': 'تعذّر تأكيد الإرسال. أعد المحاولة بالرسالة نفسها لتجنّب التكرار.',
  'Enter both titles and both messages within the character limits.': 'أدخل العنوان والرسالة باللغتين ضمن الحد الأقصى للأحرف.',
  'This send ID was already used. Refresh sent messages before sending again.': 'تم استخدام معرّف الإرسال هذا بالفعل. حدّث الرسائل المرسلة قبل الإرسال مجدداً.',
  'There are no owner accounts to notify.': 'لا توجد حسابات أصحاب مطاعم لإشعارها.',
}
export function notificationText(language: Language, text: string) { return language === 'ar' ? arabic[text] ?? text : text }
export function notificationError(error: unknown, fallback: string) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  return Object.prototype.hasOwnProperty.call(arabic, message) ? message : fallback
}
