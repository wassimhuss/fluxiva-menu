import type { Language } from './types'
const arabic: Record<string, string> = {
  'Requests': 'الطلبات', 'Branch requests': 'طلبات الفروع',
  'Request a new branch': 'طلب فرع جديد', 'Send branch request': 'إرسال طلب الفرع',
  'Submit the branch details for Fluxiva to review. Once approved, return here to create its menu.': 'أرسل تفاصيل الفرع لمراجعتها من فلوكسيفا. بعد الموافقة، عد إلى هنا لإنشاء قائمته.',
  'Branch request sent. You can check its status here.': 'تم إرسال طلب الفرع. يمكنك متابعة حالته هنا.',
  'Your branch requests': 'طلبات فروعك', 'No branch requests yet.': 'لا توجد طلبات فروع بعد.',
  'Pending': 'قيد المراجعة', 'Approved': 'مقبول', 'Rejected': 'مرفوض', 'Created': 'تم إنشاء الفرع',
  'Approve': 'موافقة', 'Reject': 'رفض', 'Approve this branch request?': 'هل تريد الموافقة على طلب الفرع؟',
  'Reject this branch request?': 'هل تريد رفض طلب الفرع؟',
  'The owner can create this branch after approval.': 'يمكن لصاحب المطعم إنشاء هذا الفرع بعد الموافقة.',
  'The owner will see your decision and note.': 'سيظهر قرارك وملاحظتك لصاحب المطعم.',
  'Note to owner (optional)': 'ملاحظة لصاحب المطعم (اختيارية)', 'Create approved branch': 'إنشاء الفرع المقبول',
  'Request approved.': 'تمت الموافقة على الطلب.', 'Request rejected.': 'تم رفض الطلب.',
  'Edit menu link': 'تعديل رابط القائمة', 'Menu link': 'رابط القائمة', 'Save link': 'حفظ الرابط',
  'Menu link updated.': 'تم تحديث رابط القائمة.',
  'The owner will use this link when creating the approved branch. Saving the link does not approve the request.': 'سيستخدم صاحب المطعم هذا الرابط عند إنشاء الفرع المقبول. حفظ الرابط لا يعني الموافقة على الطلب.',
  'Only pending branch requests can be edited': 'يمكن تعديل طلبات الفروع قيد المراجعة فقط',
  'The request link changed. Refresh and try again.': 'تغيّر رابط الطلب. حدّث الصفحة وحاول مجدداً.',
  'Use lowercase letters, numbers and single hyphens for the menu link': 'استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطات مفردة لرابط القائمة',
  'This menu link is already taken. Choose a different one.': 'رابط القائمة هذا مستخدم بالفعل. اختر رابطاً آخر.',
  'Could not update the menu link.': 'تعذّر تحديث رابط القائمة.',
  'Loading requests…': 'جارٍ تحميل الطلبات…', 'Refresh': 'تحديث', 'Cancel': 'إلغاء', 'Saving…': 'جارٍ الحفظ…',
  'Previous': 'السابق', 'Next': 'التالي', 'Page': 'الصفحة', 'pending': 'قيد المراجعة',
  'Could not load branch requests.': 'تعذّر تحميل طلبات الفروع.', 'Could not review this request.': 'تعذّرت مراجعة هذا الطلب.',
  'Request approval before creating another branch': 'اطلب الموافقة قبل إنشاء فرع آخر',
  'A request for this menu link is already pending or approved': 'يوجد طلب قيد المراجعة أو مقبول لرابط القائمة هذا',
  'This request has already been reviewed or removed': 'تمت مراجعة هذا الطلب أو حذفه بالفعل',
  'Resolve expired or suspended shops before adding another place': 'عالج حالة المطاعم المنتهية أو الموقوفة قبل إضافة فرع آخر',
}
export function branchRequestText(language: Language, text: string) { return language === 'ar' ? arabic[text] ?? text : text }
export function branchRequestError(error: unknown, fallback: string) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
  return Object.prototype.hasOwnProperty.call(arabic, message) ? message : fallback
}
