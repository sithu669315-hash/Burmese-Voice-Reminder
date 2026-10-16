import { TaskCategory, TaskPriority } from '../types';

export interface ParsedTaskResult {
  title: string;
  date: string;
  time: string;
  category: TaskCategory;
  priority: TaskPriority;
  ttsMessage: string;
}

/**
 * Intelligent Burmese NLP & Heuristic Task Parser
 * Parses natural Burmese voice phrases like:
 * "မနက်ဖြန် မနက် ၉ နာရီ ရုံးအစည်းအဝေး တက်ရန်"
 * "ညနေ ၅ နာရီ ဆေးသောက်ရန် အရေးကြီး"
 * "သဘက်ခါ နေ့လယ် ၁ နာရီ စာဖတ်ရန်"
 * Runs 100% locally in browser, requiring 0 API calls and works in any region.
 */
export function heuristicParseBurmeseTask(
  input: string,
  today: string = new Date().toISOString().split('T')[0]
): ParsedTaskResult {
  const cleanInput = input.trim();
  let title = cleanInput;
  let date = today;
  let time = '12:00';
  let category: TaskCategory = 'ကိုယ်ရေးကိုယ်တာ';
  let priority: TaskPriority = 'medium';

  const lower = cleanInput.toLowerCase();

  // 1. Date Detection
  if (lower.includes('မနက်ဖြန်') || lower.includes('နောက်နေ့')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    date = d.toISOString().split('T')[0];
  } else if (lower.includes('သဘက်ခါ')) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    date = d.toISOString().split('T')[0];
  }

  // 2. Time Detection
  if (lower.includes('မနက် ၆') || lower.includes('၆ နာရီခွဲ')) time = '06:00';
  else if (lower.includes('မနက် ၇') || lower.includes('၇ နာရီ')) time = '07:00';
  else if (lower.includes('မနက် ၈') || lower.includes('၈ နာရီ')) time = '08:00';
  else if (lower.includes('မနက် ၉') || lower.includes('၉ နာရီ')) time = '09:00';
  else if (lower.includes('မနက် ၁၀') || lower.includes('၁၀ နာရီ')) time = '10:00';
  else if (lower.includes('မနက် ၁၁') || lower.includes('၁၁ နာရီ')) time = '11:00';
  else if (lower.includes('နေ့လယ် ၁၂') || lower.includes('၁၂ နာရီ')) time = '12:00';
  else if (lower.includes('မွန်းလွဲ ၁') || lower.includes('၁ နာရီ')) time = '13:00';
  else if (lower.includes('မွန်းလွဲ ၂') || lower.includes('၂ နာရီ')) time = '14:00';
  else if (lower.includes('မွန်းလွဲ ၃') || lower.includes('၃ နာရီ')) time = '15:00';
  else if (lower.includes('ညနေ ၄') || lower.includes('၄ နာရီ')) time = '16:00';
  else if (lower.includes('ညနေ ၅') || lower.includes('၅ နာရီ')) time = '17:00';
  else if (lower.includes('ညနေ ၆') || lower.includes('၆ နာရီ')) time = '18:00';
  else if (lower.includes('ည ၇') || lower.includes('၇ နာရီ')) time = '19:00';
  else if (lower.includes('ည ၈') || lower.includes('၈ နာရီ')) time = '20:00';
  else if (lower.includes('ည ၉') || lower.includes('၉ နာရီ')) time = '21:00';
  else if (lower.includes('ည ၁၀') || lower.includes('၁၀ နာရီ')) time = '22:00';

  // 3. Category Detection
  if (
    lower.includes('အလုပ်') ||
    lower.includes('ရုံး') ||
    lower.includes('အစည်းအဝေး') ||
    lower.includes('ပရောဂျက်') ||
    lower.includes('report') ||
    lower.includes('email')
  ) {
    category = 'အလုပ်';
  } else if (
    lower.includes('ဆေး') ||
    lower.includes('ရေသောက်') ||
    lower.includes('ကျန်းမာ') ||
    lower.includes('လေ့ကျင့်ခန်း') ||
    lower.includes('လမ်းလျှောက်') ||
    lower.includes('ဆေးရုံ') ||
    lower.includes('အားကစား')
  ) {
    category = 'ကျန်းမာရေး';
  } else if (
    lower.includes('စာအုပ်') ||
    lower.includes('စာဖတ်') ||
    lower.includes('သင်တန်း') ||
    lower.includes('ကျောင်း') ||
    lower.includes('လေ့လာ') ||
    lower.includes('အင်္ဂလိပ်') ||
    lower.includes('စာမေးပွဲ')
  ) {
    category = 'ပညာရေး';
  }

  // 4. Priority Detection
  if (
    lower.includes('အရေးကြီး') ||
    lower.includes('အရေးပေါ်') ||
    lower.includes('မဖြစ်မနေ') ||
    lower.includes('အမြန်') ||
    lower.includes('urgent')
  ) {
    priority = 'high';
  } else if (lower.includes('အားရင်') || lower.includes('ဖြည်းဖြည်း') || lower.includes('ပုံမှန်')) {
    priority = 'low';
  }

  // 5. Clean Title (strip out relative timing phrases for cleaner display)
  title = title
    .replace(/(မနက်ဖြန်|သဘက်ခါ|နောက်နေ့|ဒီနေ့)/g, '')
    .replace(/(မနက်|နေ့လယ်|မွန်းလွဲ|ညနေ|ည)\s*([၀-၉0-9]+)\s*(နာရီ|နာရီခွဲ)?/g, '')
    .replace(/([၀-၉0-9]+)\s*(နာရီ|နာရီခွဲ)/g, '')
    .replace(/(အရေးကြီး|အရေးပေါ်|မဖြစ်မနေ)/g, '')
    .trim();

  if (!title) {
    title = cleanInput || 'အသံဖြင့် ထည့်သွင်းထားသော တာဝန်';
  }

  return {
    title,
    date,
    time,
    category,
    priority,
    ttsMessage: `${title} ပြုလုပ်ရန် အချိန်ကျရောက်ပါပြီ`,
  };
}
