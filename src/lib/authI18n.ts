import type { Language } from './types'

export const AUTH_LANGUAGE_KEY = 'fluxiva-landing-language'

const arabic: Record<string, string> = {
  'Welcome back': 'أهلاً بعودتك',
  'Sign in to your menu': 'سجّل الدخول إلى قائمتك',
  'Manage your restaurant details and menu.': 'أدِر تفاصيل مطعمك وقائمتك بسهولة.',
  'Sign in': 'تسجيل الدخول',
  'Start free': 'ابدأ مجاناً',
  'Create your account': 'أنشئ حسابك',
  'Your 14-day trial starts when you create your restaurant.': 'تبدأ تجربتك المجانية لمدة 14 يوماً عند إنشاء مطعمك.',
  'Create account': 'إنشاء حساب',
  'Password help': 'مساعدة كلمة المرور',
  'Reset your password': 'أعِد تعيين كلمة المرور',
  'Enter the email you signed up with and we’ll send you a link to set a new password.': 'أدخل البريد الإلكتروني الذي سجّلت به وسنرسل لك رابطاً لاختيار كلمة مرور جديدة.',
  'Send reset link': 'إرسال رابط الاستعادة',
  'A better first look at your restaurant.': 'انطباع أول أجمل عن مطعمك.',
  'One menu, two languages, always up to date.': 'قائمة واحدة، لغتان، ومعلومات محدّثة دائماً.',
  'Designed for restaurants in Lebanon.': 'مصمّمة للمطاعم في لبنان.',
  'Back to sign in': 'العودة إلى تسجيل الدخول',
  'Back home': 'العودة إلى الرئيسية',
  'You were signed out after two hours without activity. Sign in again to carry on.': 'تم تسجيل خروجك بعد ساعتين من عدم النشاط. سجّل الدخول مجدداً للمتابعة.',
  'Demo mode is active. Submit this form to preview the dashboard.': 'الوضع التجريبي مفعّل. أرسل النموذج لمعاينة لوحة التحكم.',
  'Email address': 'البريد الإلكتروني',
  'Password': 'كلمة المرور',
  'Forgot password?': 'نسيت كلمة المرور؟',
  'At least 8 characters': '8 أحرف على الأقل',
  'Hide password': 'إخفاء كلمة المرور',
  'Show password': 'إظهار كلمة المرور',
  'Please wait…': 'يرجى الانتظار…',
  'Remembered it?': 'تذكّرت كلمة المرور؟',
  'Already have an account?': 'لديك حساب بالفعل؟',
  'New to Fluxiva Menu?': 'جديد على Fluxiva Menu؟',
  'Supabase credentials are not connected yet.': 'بيانات اتصال Supabase غير مضافة بعد.',
  'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.': 'إذا كان هناك حساب بهذا البريد، فسيصلك رابط الاستعادة. تحقّق من صندوق الوارد والبريد غير المرغوب فيه.',
  'Check your email to confirm your account, then sign in.': 'تحقّق من بريدك لتأكيد الحساب، ثم سجّل الدخول.',
  'Choose a new password': 'اختر كلمة مرور جديدة',
  'Pick something you’ll remember. You’ll be signed in straight after.': 'اختر كلمة يسهل عليك تذكّرها. سيتم تسجيل دخولك مباشرة بعدها.',
  'This link can’t be used to reset a password.': 'لا يمكن استخدام هذا الرابط لإعادة تعيين كلمة المرور.',
  'This reset link is no longer valid.': 'رابط الاستعادة هذا لم يعد صالحاً.',
  'This reset link has expired or has already been used.': 'انتهت صلاحية رابط الاستعادة أو سبق استخدامه.',
  'Both passwords need to match.': 'يجب أن تتطابق كلمتا المرور.',
  'New password': 'كلمة المرور الجديدة',
  'Confirm new password': 'تأكيد كلمة المرور الجديدة',
  'Type it once more': 'اكتبها مرة أخرى',
  'Saving…': 'جارٍ الحفظ…',
  'Save new password': 'حفظ كلمة المرور الجديدة',
  'Request a new link': 'طلب رابط جديد',
  'Checking your link…': 'جارٍ التحقق من الرابط…',
}

export function authText(language: Language, english: string) {
  return language === 'ar' ? arabic[english] ?? english : english
}

export function authErrorText(language: Language, message: string) {
  if (language === 'en') return message
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (normalized.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني أولاً.'
  if (normalized.includes('user already registered')) return 'يوجد حساب بهذا البريد الإلكتروني بالفعل.'
  if (normalized.includes('rate limit')) return 'تم إجراء محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.'
  if (normalized.includes('password') && normalized.includes('characters')) return 'يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل.'
  if (normalized.includes('email') && normalized.includes('invalid')) return 'أدخل بريداً إلكترونياً صالحاً.'
  if (normalized.includes('reset link') || normalized.includes('expired') || normalized.includes('invalid link')) return 'رابط الاستعادة غير صالح أو انتهت صلاحيته.'
  if (normalized.includes('both passwords need to match')) return 'يجب أن تتطابق كلمتا المرور.'
  return 'تعذّر إكمال الطلب. حاول مجدداً.'
}
