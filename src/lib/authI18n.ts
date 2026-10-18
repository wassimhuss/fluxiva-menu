import type { Language } from './types'

export const AUTH_LANGUAGE_KEY = 'fluxiva-landing-language'

const arabic: Record<string, string> = {
  'Could not confirm account access. Please try again.': 'ما قدرنا نتأكّد من صلاحيات حسابك. جرّب كمان مرّة.',
  'Try again': 'جرّب كمان مرّة',
  'Sign out': 'خروج',
  'Welcome back': 'أهلا فيك من جديد',
  'Sign in to your menu': 'فوت عالمنيو تبعك',
  'Manage your restaurant details and menu.': 'عدّل معلومات مطعمك والمنيو بكل سهولة.',
  'Sign in': 'دخول',
  'Start free': 'بلّش مجاناً',
  'Create your account': 'اعمل حسابك',
  'Your 14-day trial starts when you create your restaurant.': 'تجربتك المجانية لـ١٤ يوم بتبلّش بس تعمل صفحة مطعمك.',
  'Create account': 'اعمل حساب',
  'Password help': 'مساعدة بالباسوورد',
  'Reset your password': 'غيّر الباسوورد',
  'Enter the email you signed up with and we’ll send you a link to set a new password.': 'حط الإيميل اللي سجّلت فيه، ومنبعتلك لينك لتختار باسوورد جديد.',
  'Send reset link': 'ابعث لينك تغيير الباسوورد',
  'A better first look at your restaurant.': 'أحلى انطباع أول عن مطعمك.',
  'One menu, two languages, always up to date.': 'منيو واحد، بلغتين، ودايماً محدّث.',
  'Designed for restaurants in Lebanon.': 'معمول للمطاعم بلبنان.',
  'Back to sign in': 'ارجع للدخول',
  'Back home': 'ارجع عالرئيسية',
  'You were signed out after two hours without activity. Sign in again to carry on.': 'طلّعناك من الحساب بعد ساعتين بلا استخدام. فوت من جديد لتكمّل.',
  'Demo mode is active. Submit this form to preview the dashboard.': 'هيدي نسخة تجريبية. عبّي المعلومات واضغط دخول لتشوف لوحة التحكّم.',
  'Email address': 'الإيميل',
  'Password': 'الباسوورد',
  'Confirm password': 'أكّد الباسوورد',
  'Show password confirmation': 'فرجي تأكيد الباسوورد',
  'Hide password confirmation': 'خبّي تأكيد الباسوورد',
  'Forgot password?': 'نسيت الباسوورد؟',
  'At least 8 characters': '٨ أحرف عالقليلة',
  'Hide password': 'خبّي الباسوورد',
  'Show password': 'فرجي الباسوورد',
  'Please wait…': 'لحظة بس…',
  'Remembered it?': 'تذكّرت الباسوورد؟',
  'Already have an account?': 'عندك حساب من قبل؟',
  'New to Fluxiva Menu?': 'أول مرّة عـFluxiva Menu؟',
  'Supabase credentials are not connected yet.': 'بعد ما ربطنا بيانات Supabase.',
  'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.': 'إذا في حساب بهالإيميل، رح يوصلك لينك لتغيير الباسوورد. شوف الإيميل وملف السبام كمان.',
  'Check your email to confirm your account, then sign in.': 'افتح الإيميل وأكّد حسابك، وبعدين فوت.',
  'Choose a new password': 'اختار باسوورد جديد',
  'Pick something you’ll remember. You’ll be signed in straight after.': 'اختار باسوورد بتتذكّرو. بعدها بتفوت عحسابك دغري.',
  'This link can’t be used to reset a password.': 'هاللينك ما بينفع لتغيير الباسوورد.',
  'This reset link is no longer valid.': 'هاللينك ما بقى شغّال.',
  'This reset link has expired or has already been used.': 'هاللينك خلصت صلاحيّتو أو استعملتو من قبل.',
  'Both passwords need to match.': 'لازم الباسوورد يكون نفسو بالخانتين.',
  'New password': 'الباسوورد الجديد',
  'Confirm new password': 'أكّد الباسوورد الجديد',
  'Type it once more': 'اكتبو كمان مرّة',
  'Saving…': 'عم نحفظ…',
  'Save new password': 'احفظ الباسوورد الجديد',
  'Request a new link': 'اطلب لينك جديد',
  'Checking your link…': 'عم نتأكّد من اللينك…',
}

export function authText(language: Language, english: string) {
  return language === 'ar' ? arabic[english] ?? english : english
}

export function authErrorText(language: Language, message: string) {
  if (language === 'en') return message
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'الإيميل أو الباسوورد مش صحيح.'
  if (normalized.includes('email not confirmed')) return 'أكّد الإيميل تبعك بالأول.'
  if (normalized.includes('user already registered')) return 'في حساب بهالإيميل من قبل.'
  if (normalized.includes('rate limit')) return 'جرّبت مرّات كتيرة. انطر شوي وجرّب من جديد.'
  if (normalized.includes('password') && normalized.includes('characters')) return 'الباسوورد لازم يكون ٨ أحرف عالقليلة.'
  if (normalized.includes('email') && normalized.includes('invalid')) return 'حط إيميل صحيح.'
  if (normalized.includes('reset link') || normalized.includes('expired') || normalized.includes('invalid link')) return 'لينك تغيير الباسوورد مش صحيح أو خلصت صلاحيّتو.'
  if (normalized.includes('both passwords need to match')) return 'لازم الباسوورد يكون نفسو بالخانتين.'
  return 'ما قدرنا نكمّل الطلب. جرّب كمان مرّة.'
}
