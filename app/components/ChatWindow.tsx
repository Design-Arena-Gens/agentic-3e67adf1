'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Lang = 'en' | 'ar';

type Message = {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  language: Lang;
  timestamp: number;
};

type ServiceId = 'haircut' | 'beard' | 'combo' | 'facial' | 'dye' | 'kids';

type Service = {
  id: ServiceId;
  labels: Record<Lang, string>;
  description: Record<Lang, string>;
};

type SlotOption = {
  id: string;
  iso: string;
  display: Record<Lang, string>;
};

type Appointment = {
  id: string;
  clientName: string;
  phone: string;
  service: ServiceId;
  slot: SlotOption;
  language: Lang;
  reminderSent: boolean;
};

type BookingStage = 'selectSlot' | 'collectService' | 'collectName' | 'collectPhone';

type BookingState = {
  stage: BookingStage;
  language: Lang;
  options: SlotOption[];
  collected: Partial<{
    slot: SlotOption;
    service: ServiceId;
    clientName: string;
    phone: string;
  }>;
};

type RescheduleStage = 'selectAppointment' | 'selectSlot' | 'confirm';

type RescheduleState = {
  stage: RescheduleStage;
  language: Lang;
  targetAppointment?: Appointment;
  options: SlotOption[];
};

const WORKING_HOURS = {
  open: 10,
  close: 20,
  closedOn: 0 // Sunday
};

const SERVICES: Service[] = [
  {
    id: 'haircut',
    labels: {
      en: 'Signature Fade & Cut',
      ar: 'قصّة فيد مميزة'
    },
    description: {
      en: 'Tailored fade or scissor cut with a clean finish.',
      ar: 'تدريج أو قص بالمقص حسب شكل الوجه مع إنهاء نظيف.'
    }
  },
  {
    id: 'beard',
    labels: {
      en: 'Beard Trim & Shape',
      ar: 'تشذيب اللحية وتشكيلها'
    },
    description: {
      en: 'Detailed beard sculpting, hot towel, and finishing oils.',
      ar: 'تشكيل دقيق للحية مع منشفة ساخنة وزيوت نهائية.'
    }
  },
  {
    id: 'combo',
    labels: {
      en: 'The Fresh Combo',
      ar: 'باقة الانتعاش'
    },
    description: {
      en: 'Haircut + beard detailing with complimentary styling.',
      ar: 'قص شعر مع تشذيب لحية وتصفيف نهائي مجاني.'
    }
  },
  {
    id: 'facial',
    labels: {
      en: 'Gentleman Facial Care',
      ar: 'عناية الوجه للرجال'
    },
    description: {
      en: 'Deep cleanse, exfoliation, and hydrating mask.',
      ar: 'تنظيف عميق، تقشير، وماسك مرطب.'
    }
  },
  {
    id: 'dye',
    labels: {
      en: 'Color & Grey Coverage',
      ar: 'صبغة وتغطية الشيب'
    },
    description: {
      en: 'Personalized hair color or beard coverage treatment.',
      ar: 'صبغة مخصّصة للشعر أو تغطية الشيب للحية.'
    }
  },
  {
    id: 'kids',
    labels: {
      en: 'Kids Cut (under 12)',
      ar: 'قصّة أطفال (دون ١٢ سنة)'
    },
    description: {
      en: 'Patient, fun cuts designed to keep the little ones smiling.',
      ar: 'قصّات ممتعة وصبورة لإبقاء الصغار مبتسمين.'
    }
  }
];

const SERVICE_KEYWORDS: Record<ServiceId, string[]> = {
  haircut: ['haircut', 'cut', 'fade', 'قص', 'حلاقة', 'شعر'],
  beard: ['beard', 'shave', 'لحية', 'ذقن'],
  combo: ['combo', 'both', 'together', 'كامل', 'باقة', 'كومبو'],
  facial: ['facial', 'skin', 'وجه', 'بشرة'],
  dye: ['dye', 'color', 'صبغة', 'لون'],
  kids: ['kid', 'child', 'boy', 'طفل', 'ولد']
};

const HAIRSTYLE_GUIDE: Record<Lang, string> = {
  en: `Here are a few go-to styles:
- High Fade: sharp on the sides, great for round faces to add height.
- Low Skin Fade: smooth blend that suits square or oval faces.
- Textured Crop: short with texture on top, awesome for wavy hair.
- Crew Cut: clean and low maintenance, perfect for athletic looks.
- Pompadour: volume up top, best for oval or diamond face shapes.
- Slick Back Undercut: bold contrast for strong jawlines.
Tell me your face shape or vibe and I can fine-tune the recommendation!`,
  ar: `بعض القصّات المضمونة:
- هاي فيد: جوانب حادة تعطي طول إضافي مثالي للوجه الدائري.
- لو فيد سكين: دمج ناعم يناسب الوجوه المربعة أو البيضاوية.
- تكتشر كروب: قصير مع تكستير بالأعلى، رائع للشعر المموج.
- كرو كت: عملي ونظيف، مثالي للمظهر الرياضي.
- بومبادور: حجم بالأعلى، ممتاز للوجوه البيضاوية أو الماسية.
- سليك باك أندركت: تباين جريء يبرز خط الفكين.
احكيلي عن شكل وجهك أو الستايل اللي تفضله وأرشح لك الأنسب!`
};

function detectLanguage(text: string): Lang {
  return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
}

function copy(lang: Lang, en: string, ar: string) {
  return lang === 'ar' ? ar : en;
}

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function generateSlotOptions(count = 6, booked: Set<string> = new Set()): SlotOption[] {
  const now = new Date();
  const options: SlotOption[] = [];

  let cursor = new Date(now);
  cursor.setHours(WORKING_HOURS.open, 0, 0, 0);

  const pushSlot = (date: Date) => {
    const iso = date.toISOString();
    if (booked.has(iso)) {
      return;
    }
    const dateEn = date.toLocaleDateString('en', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const dateAr = date.toLocaleDateString('ar', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const timeEn = date.toLocaleTimeString('en', {
      hour: 'numeric',
      minute: '2-digit'
    });
    const timeAr = date.toLocaleTimeString('ar', {
      hour: 'numeric',
      minute: '2-digit'
    });

    options.push({
      id: iso,
      iso,
      display: {
        en: `${dateEn} • ${timeEn}`,
        ar: `${dateAr} • ${timeAr}`
      }
    });
  };

  let attempts = 0;
  while (options.length < count && attempts < 500) {
    attempts += 1;
    if (cursor.getDay() === WORKING_HOURS.closedOn) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKING_HOURS.open, 0, 0, 0);
      continue;
    }

    const slot = new Date(cursor);
    if (slot > now && slot.getHours() >= WORKING_HOURS.open && slot.getHours() < WORKING_HOURS.close) {
      pushSlot(slot);
    }

    cursor.setHours(cursor.getHours() + 2);
    if (cursor.getHours() >= WORKING_HOURS.close) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKING_HOURS.open, 0, 0, 0);
    }
  }

  return options;
}

function formatAppointment(appointment: Appointment, lang: Lang) {
  const service = SERVICES.find((service) => service.id === appointment.service);
  const serviceLabel = service ? service.labels[lang] : appointment.service;
  return copy(
    lang,
    `${serviceLabel} on ${appointment.slot.display.en} for ${appointment.clientName}`,
    `${serviceLabel} يوم ${appointment.slot.display.ar} للعميل ${appointment.clientName}`
  );
}

function matchService(text: string): ServiceId | undefined {
  const normalized = normalize(text);
  for (const [id, keywords] of Object.entries(SERVICE_KEYWORDS) as [ServiceId, string[]][]) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return id;
    }
  }
  return undefined;
}

function detectIntent(text: string):
  | 'greeting'
  | 'booking'
  | 'reschedule'
  | 'hours'
  | 'services'
  | 'advice'
  | 'thanks'
  | 'reminder'
  | 'smalltalk'
  | 'unknown' {
  const normalized = normalize(text);

  if (/\b(hi|hello|hey|salam|salaam)\b/.test(normalized) || normalized.includes('مرحبا') || normalized.includes('السلام')) {
    return 'greeting';
  }

  if (/(book|appointment|reserve|schedule|حجز|موعد|احجز)/.test(normalized)) {
    return 'booking';
  }

  if (/(resched|change|تغيير|تعديل|أجل)/.test(normalized)) {
    return 'reschedule';
  }

  if (/(hour|open|close|working|متى|ساعات|تفتح|دوام)/.test(normalized)) {
    return 'hours';
  }

  if (/(service|offer|عروض|خدمات)/.test(normalized)) {
    return 'services';
  }

  if (/(style|hair|look|fade|pompadour|قصات|ستايل|شكل)/.test(normalized)) {
    return 'advice';
  }

  if (/(thanks|thank you|gracias|شكرا|ممنون)/.test(normalized)) {
    return 'thanks';
  }

  if (/(remind|تذكير|ذكرني)/.test(normalized)) {
    return 'reminder';
  }

  if (/(how are you|كيف حالك|شو الأخبار)/.test(normalized)) {
    return 'smalltalk';
  }

  return 'unknown';
}

function createMessage(sender: Message['sender'], text: string, language: Lang): Message {
  return {
    id: crypto.randomUUID(),
    sender,
    text,
    language,
    timestamp: Date.now()
  };
}

function listServices(lang: Lang) {
  return SERVICES.map((service, index) => `${index + 1}. ${service.labels[lang]} — ${service.description[lang]}`).join('\n');
}

function getServiceFromSelection(input: string, lang: Lang): ServiceId | undefined {
  const normalized = normalize(input);
  const numberMatch = normalized.match(/(\d+)/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    return SERVICES[index]?.id;
  }
  return matchService(normalized);
}

function listSlotOptions(options: SlotOption[], lang: Lang) {
  return options
    .map((slot, index) => `${index + 1}. ${slot.display[lang]}${lang === 'en' ? '' : ''}`)
    .join('\n');
}

function within24Hours(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff <= 1000 * 60 * 60 * 24;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>(() => [
    createMessage(
      'assistant',
      'Welcome to the chair my friend! I\'m BarberAI — ready to get you fresh. How can I help you today?',
      'en'
    )
  ]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bookingState, setBookingState] = useState<BookingState | null>(null);
  const [rescheduleState, setRescheduleState] = useState<RescheduleState | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const upcoming = appointments.filter((appointment) => !appointment.reminderSent && within24Hours(appointment.slot.iso));
    if (upcoming.length === 0) {
      return;
    }

    setAppointments((previous) =>
      previous.map((appointment) =>
        upcoming.some((item) => item.id === appointment.id)
          ? {
              ...appointment,
              reminderSent: true
            }
          : appointment
      )
    );

    upcoming.forEach((appointment) => {
      const reminder = copy(
        appointment.language,
        `Heads up ${appointment.clientName}! You\'re booked for ${appointment.slot.display.en}. Need to adjust? Just say the word.`,
        `يا ${appointment.clientName}! تذكير بسيط بموعدك يوم ${appointment.slot.display.ar}. حاب تعدل؟ قول لي بس.`
      );
      setMessages((previous) => [...previous, createMessage('assistant', reminder, appointment.language)]);
    });
  }, [appointments]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const language = detectLanguage(trimmed);
    const userMessage = createMessage('user', trimmed, language);
    setMessages((previous) => [...previous, userMessage]);

    setTimeout(() => {
      processInput(trimmed, language);
    }, 120);

    setInput('');
  };

  const processInput = (text: string, language: Lang) => {
    if (bookingState) {
      handleBookingFlow(text, language);
      return;
    }

    if (rescheduleState) {
      handleRescheduleFlow(text, language);
      return;
    }

    const intent = detectIntent(text);

    switch (intent) {
      case 'greeting':
        pushAssistant(copy(language, `Hey! What can I do for you today?`, 'هلا! وش حاب نسوي اليوم؟'), language);
        break;
      case 'booking':
        startBookingFlow(text, language);
        break;
      case 'reschedule':
        startRescheduleFlow(language);
        break;
      case 'hours':
        respondWithHours(language);
        break;
      case 'services':
        respondWithServices(language);
        break;
      case 'advice':
        pushAssistant(HAIRSTYLE_GUIDE[language], language);
        break;
      case 'thanks':
        pushAssistant(copy(language, `Anytime! Your look is my mission.`, 'على الرحب دائمًا! ستايلك مهمتي.'), language);
        break;
      case 'reminder':
        respondWithReminderStatus(language);
        break;
      case 'smalltalk':
        pushAssistant(
          copy(language, `Always good! Keeping fades sharp and clients smiling.`, 'دوم بخير! نحافظ على الفيد مرتب والناس مبسوطين.'),
          language
        );
        break;
      default:
        handleUnknown(language);
        break;
    }
  };

  const pushAssistant = (text: string, language: Lang) => {
    setMessages((previous) => [...previous, createMessage('assistant', text, language)]);
  };

  const startBookingFlow = (text: string, language: Lang) => {
    const booked = new Set(appointments.map((appointment) => appointment.slot.iso));
    const options = generateSlotOptions(6, booked);
    if (options.length === 0) {
      pushAssistant(
        copy(language, `We're fully booked at the moment, but I can waitlist you. Want me to take your details?`, 'كل المواعيد محجوزة حالياً، أقدر أضيفك لقائمة الانتظار، تبغى؟'),
        language
      );
      return;
    }
    const maybeService = matchService(text);
    const initialCollected: BookingState['collected'] = {};
    if (maybeService) {
      initialCollected.service = maybeService;
    }

    const servicePrompt = maybeService
      ? copy(language, `Locked in the ${getServiceLabel(maybeService, language)}.`, `تم تثبيت خدمة ${getServiceLabel(maybeService, language)}.`)
      : '';

    const intro = copy(
      language,
      `${servicePrompt ? servicePrompt + '\n' : ''}Let me show you the earliest open slots, pick the number that suits you:`,
      `${servicePrompt ? servicePrompt + '\n' : ''}خليني أوضح لك أقرب المواعيد المتاحة، اختار الرقم اللي يناسبك:`
    );

    const slotList = listSlotOptions(options, language);
    pushAssistant(`${intro}\n${slotList}`, language);

    setBookingState({
      stage: 'selectSlot',
      language,
      options,
      collected: initialCollected
    });
  };

  const handleBookingFlow = (text: string, language: Lang) => {
    if (!bookingState) return;
    let nextState = bookingState;

    if (bookingState.stage === 'selectSlot') {
      const selection = extractSelection(text, bookingState.options);
      if (!selection) {
        pushAssistant(
          copy(language, `Hit me with a number from the list so I can lock it in.`, 'اختار رقم من القائمة عشان أأكد لك الموعد.'),
          language
        );
        return;
      }
      nextState = {
        ...bookingState,
        stage: bookingState.collected.service ? 'collectName' : 'collectService',
        collected: {
          ...bookingState.collected,
          slot: selection
        }
      };

      if (!bookingState.collected.service) {
        const serviceList = listServices(language);
        pushAssistant(
          copy(
            language,
            `Nice pick! Which service are you after?\n${serviceList}`,
            `اختيار موفق! أي خدمة حاب؟\n${serviceList}`
          ),
          language
        );
      } else {
        pushAssistant(copy(language, `Got it. What name should I put on the booking?`, 'تم. على أي اسم أسجل الموعد؟'), language);
      }

      setBookingState(nextState);
      return;
    }

    if (bookingState.stage === 'collectService') {
      const serviceId = getServiceFromSelection(text, language);
      if (!serviceId) {
        pushAssistant(copy(language, `Tell me which service from the list you want.`, 'اختر الخدمة من القائمة لو سمحت.'), language);
        return;
      }
      nextState = {
        ...bookingState,
        stage: 'collectName',
        collected: {
          ...bookingState.collected,
          service: serviceId
        }
      };
      pushAssistant(copy(language, `Beautiful choice! Under what name?`, 'خيار جميل! على أي اسم؟'), language);
      setBookingState(nextState);
      return;
    }

    if (bookingState.stage === 'collectName') {
      const name = text.trim();
      if (name.length < 2) {
        pushAssistant(copy(language, `Give me the full name so I can save it right.`, 'أحتاج الاسم كامل لو سمحت.'), language);
        return;
      }
      nextState = {
        ...bookingState,
        stage: 'collectPhone',
        collected: {
          ...bookingState.collected,
          clientName: name
        }
      };
      pushAssistant(copy(language, `Perfect. Drop a phone number in case we need to reach you.`, 'تمام. عطنا رقم الجوال لو احتجنا نتواصل.'), language);
      setBookingState(nextState);
      return;
    }

    if (bookingState.stage === 'collectPhone') {
      const digits = text.replace(/[^0-9+]/g, '');
      if (digits.length < 8) {
        pushAssistant(copy(language, `That number seems short. Try again with the full digits.`, 'الرقم قصير. ارسل الرقم كامل لو سمحت.'), language);
        return;
      }

      const booking = {
        slot: bookingState.collected.slot!,
        service: bookingState.collected.service!,
        clientName: bookingState.collected.clientName!,
        phone: digits
      };

      const appointment: Appointment = {
        id: crypto.randomUUID(),
        ...booking,
        language,
        reminderSent: within24Hours(booking.slot.iso)
      };

      setAppointments((previous) => [...previous, appointment]);

      const confirmation = copy(
        language,
        `All set! ${booking.clientName}, your ${getServiceLabel(booking.service, language)} is booked for ${booking.slot.display.en}. I\'ll ping you before the appointment.`,
        `كل شي تمام! ${booking.clientName}، خدمة ${getServiceLabel(booking.service, language)} محجوزة لك يوم ${booking.slot.display.ar}. برسلك تذكير قبل الموعد.`
      );
      pushAssistant(confirmation, language);

      if (!appointment.reminderSent) {
        pushAssistant(
          copy(
            language,
            `Expect a reminder 24 hours ahead. Need anything else?`,
            `تابع تذكير يوصل لك قبل الموعد بـ ٢٤ ساعة. تبغى شي ثاني؟`
          ),
          language
        );
      }

      setBookingState(null);
      return;
    }
  };

  const startRescheduleFlow = (language: Lang) => {
    if (appointments.length === 0) {
      pushAssistant(
        copy(language, `You have no bookings yet. Want me to grab you a fresh slot?`, 'ما عندك حجوزات حالياً. تحب أحجز لك موعد جديد؟'),
        language
      );
      return;
    }

    const list = appointments
      .map((appointment, index) => `${index + 1}. ${formatAppointment(appointment, language)}`)
      .join('\n');

    pushAssistant(
      copy(language, `Which appointment should we move? Reply with the number.\n${list}`, `أي موعد نغيره؟ رد بالرقم.\n${list}`),
      language
    );

    setRescheduleState({
      stage: 'selectAppointment',
      language,
      options: []
    });
  };

  const handleRescheduleFlow = (text: string, language: Lang) => {
    if (!rescheduleState) return;

    if (rescheduleState.stage === 'selectAppointment') {
      const index = parseInt(text.trim(), 10) - 1;
      if (Number.isNaN(index) || index < 0 || index >= appointments.length) {
        pushAssistant(copy(language, `Give me the number from the list so I know which one to move.`, 'اكتب رقم الموعد من القائمة عشان أعرف أي واحد أغير.'), language);
        return;
      }

      const target = appointments[index];
      const booked = new Set(appointments.filter((item) => item.id !== target.id).map((item) => item.slot.iso));
      const options = generateSlotOptions(6, booked);
      if (options.length === 0) {
        pushAssistant(
          copy(language, `No free slots left today, but I can keep you posted when one opens.`, 'ما في أوقات فاضية حاليًا، أقدر أخبرك أول ما يتوفر وقت.'),
          language
        );
        setRescheduleState(null);
        return;
      }
      const slotList = listSlotOptions(options, language);
      pushAssistant(
        copy(language, `Got you. Pick the new time slot: \n${slotList}`, `تم. اختر الوقت الجديد: \n${slotList}`),
        language
      );
      setRescheduleState({
        stage: 'selectSlot',
        language,
        targetAppointment: target,
        options
      });
      return;
    }

    if (rescheduleState.stage === 'selectSlot' && rescheduleState.targetAppointment) {
      const selection = extractSelection(text, rescheduleState.options);
      if (!selection) {
        pushAssistant(copy(language, `I need the number from the list to switch the booking.`, 'أحتاج رقم من القائمة عشان أبدل الموعد.'), language);
        return;
      }

      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment.id === rescheduleState.targetAppointment!.id
            ? {
                ...appointment,
                slot: selection,
                reminderSent: within24Hours(selection.iso)
              }
            : appointment
        )
      );

      pushAssistant(
        copy(
          language,
          `Done! Your appointment now sits at ${selection.display.en}. Anything else on your mind?`,
          `تم! صار موعدك الآن يوم ${selection.display.ar}. في شي ثاني بخاطرك؟`
        ),
        language
      );
      setRescheduleState(null);
      return;
    }
  };

  const respondWithHours = (language: Lang) => {
    const now = new Date();
    const isClosedDay = now.getDay() === WORKING_HOURS.closedOn;
    const isOpenHours = now.getHours() >= WORKING_HOURS.open && now.getHours() < WORKING_HOURS.close && !isClosedDay;
    const status = isOpenHours
      ? copy(language, `We\'re open right now and ready for you!`, 'نحن فاتحين الحين ومستعدين نخدمك!')
      : copy(language, `We\'re closed at the moment.`, 'حاليًا المحل مقفل.');

    const hours = copy(
      language,
      `Hours: Monday to Saturday ${formatHour(WORKING_HOURS.open)} - ${formatHour(WORKING_HOURS.close)}. Sundays we take the scissors off.`,
      `أوقات الدوام: من الاثنين للسبت من ${formatHour(WORKING_HOURS.open)} إلى ${formatHour(WORKING_HOURS.close)}. الأحد عطلة.`
    );

    pushAssistant(`${status}\n${hours}`, language);
  };

  const respondWithServices = (language: Lang) => {
    const list = listServices(language);
    pushAssistant(copy(language, `Here\'s what we offer:\n${list}`, `هذه خدماتنا:\n${list}`), language);
  };

  const respondWithReminderStatus = (language: Lang) => {
    if (appointments.length === 0) {
      pushAssistant(copy(language, `No reminders yet. Ready to lock in your next visit?`, 'ما عندك مواعيد للحين. مستعد نحجز لك الزيارة الجاية؟'), language);
      return;
    }

    const reminders = appointments
      .map((appointment) => {
        const diff = new Date(appointment.slot.iso).getTime() - Date.now();
        const hours = Math.ceil(diff / (1000 * 60 * 60));
        return copy(
          language,
          `${appointment.clientName} — reminder arrives about ${hours}h before ${appointment.slot.display.en}.`,
          `${appointment.clientName} — التذكير يوصل قبل حوالي ${hours} ساعة من ${appointment.slot.display.ar}.`
        );
      })
      .join('\n');

    pushAssistant(reminders, language);
  };

  const handleUnknown = (language: Lang) => {
    pushAssistant(
      copy(
        language,
        `I\'m here for bookings, advice, or quick questions. Tell me what you need and I\'ll make it happen.`,
        `أنا هنا للحجوزات والنصائح والأسئلة السريعة. علمني وش تحتاج وأنفذه لك.`
      ),
      language
    );
  };

  const extractSelection = (text: string, options: SlotOption[]) => {
    const match = text.match(/(\d+)/);
    if (!match) return undefined;
    const index = Number.parseInt(match[1], 10) - 1;
    return options[index];
  };

  const getServiceLabel = (service: ServiceId, language: Lang) => {
    return SERVICES.find((item) => item.id === service)?.labels[language] ?? service;
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={scrollRef}
        className="h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner"
      >
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-lg transition-all ${
                  message.sender === 'user'
                    ? 'bg-accent/80 text-slate-900'
                    : 'bg-white/10 text-slate-100 backdrop-blur'
                }`}
                dir={message.language === 'ar' ? 'rtl' : 'ltr'}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message... / اكتب رسالتك"
            className="flex-1 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-slate-100 outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-orange-500"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function formatHour(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const standardHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${standardHour}:00 ${period}`;
}
