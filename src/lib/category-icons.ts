import {
  Baby,
  Briefcase,
  Car,
  ChartLine,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shapes,
  Shirt,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Starter categories by their fixed seed IDs (db.ts), so renaming keeps the icon.
const BY_ID: Record<string, LucideIcon> = {
  'fe23e89c-0b86-4464-9027-92525681e009': Wallet, // Income
  'cea4fe4b-9359-492f-a62b-fcb82b766afc': PiggyBank, // Savings
  '89eb5e09-b849-4016-8892-83ec577c698b': ChartLine, // Investments
  '98c609bf-eb66-4ec7-8337-0bd7ea60da04': Car, // Transport
  '602b8a77-3b3c-42a9-8b84-468f3d2d76d1': Utensils, // Food
  'd38867a1-f80b-41d3-a28e-0bc89241ed99': Repeat, // Subscriptions
  'c4568ee2-18a8-4cfe-86f8-362a1eb34e94': Gift, // Gifts
  'a8ef6482-d7cf-4765-b8e9-d24c5725032f': Shirt, // Clothes
  'b3be51f6-d163-48c7-b965-6f023a049983': Shapes, // Miscellaneous
}

// Categories the user adds get an icon from a keyword in their name, else a tag.
const BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/rent|house|home|housing/i, House],
  [/grocer|shop|market/i, ShoppingCart],
  [/fuel|petrol|gas station/i, Fuel],
  [/airtime|data|phone|mobile/i, Smartphone],
  [/internet|wifi|broadband/i, Wifi],
  [/electric|utilit|water|bill/i, Zap],
  [/health|medic|hospital|pharm/i, HeartPulse],
  [/school|educat|tuition|course|book/i, GraduationCap],
  [/movie|cinema|entertain|game/i, Film],
  [/travel|flight|trip|holiday/i, Plane],
  [/gym|fitness|sport/i, Dumbbell],
  [/child|kid|baby/i, Baby],
  [/work|business|freelance|salary/i, Briefcase],
  [/coffee|cafe|snack|drink/i, Coffee],
  [/fee|tax|charge/i, Receipt],
]

export function categoryIcon(id: string, name = ''): LucideIcon {
  const known = BY_ID[id]
  if (known) return known
  return BY_KEYWORD.find(([pattern]) => pattern.test(name))?.[1] ?? Tag
}
