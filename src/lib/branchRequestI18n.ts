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
  'Loading requests…': 'جارٍ تحميل الطلبات…', 'Refresh': 'تحديث', 'Cancel': 'إلغاء', 'Saving…': 'جارٍ الحفظ…',
  'Previous': 'السابق', 'Next': 'التالي', 'Page': 'الصفحة', 'pending': 'قيد المراجعة',
  'Could not load branch requests.': 'تعذّر تحميل طلبات الفروع.', 'Could not review this request.': 'تعذّرت مراجعة هذا الطلب.',
  'Request approval before creating another branch': 'اطلب الموافقة قبل إنشاء فرع آخر',
  'A request for this menu link is already pending or approved': 'يوجد طلب قيد المراجعة أو مقبول لرابط القائمة هذا',
  'This request has already been reviewed or removed': 'تمت مراجعة هذا الطلب أو حذفه بالفعل',
  'Resolve expired or suspended shops before adding another place': 'عالج حالة المطاعم المنتهية أو الموقوفة قبل إضافة فرع آخر',
}
export function branchRequestText(language: Language, text: string) { return language === 'ar' ? arabic[text] ?? text : text }
