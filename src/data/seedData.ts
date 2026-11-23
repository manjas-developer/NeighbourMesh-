import type {
  CommunityIssue,
  EmergencyAlert,
  LanguageOption,
  NeighborhoodZone,
  ResourceListing,
} from '../types';

export const ASSET_IMAGES = {
  heroCommunity: '/src/assets/images/hero_neighborhood_community_1795358361881.jpg',
  toolsKit: '/src/assets/images/tool_stepladder_kit_1795358362099.jpg',
  medicalKit: '/src/assets/images/medical_care_kit_1795358361618.jpg',
  tutoringDesk: '/src/assets/images/tutoring_books_desk_1795358361564.jpg',
  communityHub: '/src/assets/images/community_hub_library_1795358361919.jpg',
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  'English',
  'Spanish',
  'Hindi',
  'Mandarin Chinese',
  'Tamil',
  'Arabic',
];

export const NEIGHBORHOOD_ZONES: NeighborhoodZone[] = [
  {
    id: 'oakridge-north',
    name: 'Oakridge North',
    approxRadiusMeters: 400,
    hubLandmark: 'Oakridge RWA Community Porch',
    mapX: 46,
    mapY: 42,
    kmX: 0.0,
    kmY: 0.0,
  },
  {
    id: 'cedar-park',
    name: 'Cedar Park West',
    approxRadiusMeters: 450,
    hubLandmark: 'Cedar Branch Library Lobby',
    mapX: 25,
    mapY: 54,
    kmX: -0.65,
    kmY: 0.35,
  },
  {
    id: 'maple-terrace',
    name: 'Maple Terrace',
    approxRadiusMeters: 380,
    hubLandmark: 'Maple Gate Pavilion',
    mapX: 68,
    mapY: 32,
    kmX: 0.72,
    kmY: -0.4,
  },
  {
    id: 'riverbend',
    name: 'Riverbend Commons',
    approxRadiusMeters: 500,
    hubLandmark: 'Riverbend Tool Lending Hub',
    mapX: 72,
    mapY: 68,
    kmX: 1.05,
    kmY: 0.85,
  },
  {
    id: 'linden-square',
    name: 'Linden Square',
    approxRadiusMeters: 420,
    hubLandmark: 'Linden Elementary Courtyard',
    mapX: 30,
    mapY: 22,
    kmX: -0.52,
    kmY: -0.78,
  },
];

export function getZoneById(zoneId: string): NeighborhoodZone {
  return NEIGHBORHOOD_ZONES.find((z) => z.id === zoneId) || NEIGHBORHOOD_ZONES[0];
}

export function getDistanceKm(zoneAId: string, zoneBId: string): number {
  if (zoneAId === zoneBId) return 0.25;
  const a = getZoneById(zoneAId);
  const b = getZoneById(zoneBId);
  const dx = a.kmX - b.kmX;
  const dy = a.kmY - b.kmY;
  return Math.round(Math.hypot(dx, dy) * 100) / 100;
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `~${Math.round(km * 1000)}m zone`;
  }
  return `~${km.toFixed(1)} km zone`;
}

export const INITIAL_LISTINGS: ResourceListing[] = [
  {
    id: 'res-stepladder',
    title: '6-Foot Aluminum Stepladder',
    category: 'Tool',
    description:
      'Lightweight folding A-frame aluminum stepladder with wide anti-slip steps and top paint/tool tray. Safely reaches 9 to 10-foot ceilings, ceiling fans, curtain rods, and overhead light fixtures.',
    ownerName: 'Priya Menon',
    ownerRole: 'Verified Oakridge Resident',
    zoneId: 'oakridge-north',
    availability: 'Weekdays after 5:30 PM & weekends',
    safeHandoff: 'Front porch pickup near Oakridge North mailbox cluster; return within 48 hours.',
    borrowCount: 14,
    imageUrl: ASSET_IMAGES.toolsKit,
    messages: [
      {
        id: 'm-101',
        author: 'Priya Menon',
        zoneName: 'Oakridge North',
        timestamp: 'Yesterday, 6:15 PM',
        text: 'Happy to lend this out anytime after 5:30 PM—just message ahead so I can leave it unlocked on the porch.',
        originalLanguage: 'English',
      },
    ],
  },
  {
    id: 'res-drill-kit',
    title: '18V Cordless Drill, Driver Bits & Stud Finder',
    category: 'Tool',
    description:
      'Compact brushless cordless drill with two charged batteries, masonry & wood drill bits, screwdriver heads, level, and electronic wall stud finder for mounting shelves, mirrors, or tightening hinges.',
    ownerName: 'Marcus Reid',
    ownerRole: 'Woodworker & Neighbor',
    zoneId: 'cedar-park',
    availability: 'Daily 8:00 AM – 8:00 PM',
    safeHandoff: 'Meet at Cedar Branch Library bench or quick driveway handoff.',
    borrowCount: 19,
    imageUrl: ASSET_IMAGES.toolsKit,
    messages: [
      {
        id: 'm-102',
        author: 'Marcus Reid',
        zoneName: 'Cedar Park West',
        timestamp: '2 days ago',
        text: 'Both batteries are freshly charged. Let me know if you also need drywall anchors.',
        originalLanguage: 'English',
      },
    ],
  },
  {
    id: 'res-bp-monitor',
    title: 'Digital Upper-Arm Blood Pressure Monitor & Pulse Oximeter',
    category: 'Medical',
    description:
      'Clinically validated Omron-style automatic upper-arm cuff with large readable display for seniors, plus fingertip oxygen saturation monitor. Sanitized after every loan.',
    ownerName: 'Dr. Kavita Rao',
    ownerRole: 'Retired Family Physician',
    zoneId: 'oakridge-north',
    availability: 'Available on short notice',
    safeHandoff: 'Contactless lobby handoff at Oakridge RWA Porch; quick cuff demonstration included if helpful.',
    borrowCount: 11,
    imageUrl: ASSET_IMAGES.medicalKit,
    emergencyReady: true,
    messages: [
      {
        id: 'm-103',
        author: 'Dr. Kavita Rao',
        zoneName: 'Oakridge North',
        timestamp: '3 days ago',
        text: 'मैं बुजुर्ग पड़ोसियों को ब्लड प्रेशर चेक करना सिखाने में भी मदद कर सकती हूँ।',
        originalLanguage: 'Hindi',
      },
    ],
  },
  {
    id: 'res-tutoring-math',
    title: 'High School Math, Trigonometry & Physics Tutoring',
    category: 'Education',
    description:
      'Free 1-hour evening homework help and exam prep for grades 9–12 covering algebra, geometry, trigonometry, AP calculus, and introductory mechanics. Textbooks and graphing calculator available to borrow.',
    ownerName: 'Daniel Cho',
    ownerRole: 'Civil Engineer & Volunteer Tutor',
    zoneId: 'maple-terrace',
    availability: 'Tue, Thu & Sun evenings (6:00–8:30 PM)',
    safeHandoff: 'Sessions held at Cedar Branch Library study room or Maple Gate Pavilion.',
    borrowCount: 22,
    imageUrl: ASSET_IMAGES.tutoringDesk,
    messages: [
      {
        id: 'm-104',
        author: 'Daniel Cho',
        zoneName: 'Maple Terrace',
        timestamp: 'Yesterday, 4:00 PM',
        text: 'Happy to review trig identities or practice tests before Friday quizzes—two open slots left this week.',
        originalLanguage: 'English',
      },
    ],
  },
  {
    id: 'res-plumbing',
    title: 'Basic Home Plumbing & Leak Troubleshooting',
    category: 'Skill',
    description:
      'Hands-on neighborhood help fixing dripping kitchen faucets, running toilet flappers, clogged P-traps, and under-sink shutoff valves. Brings basin wrench and plumber tape.',
    ownerName: 'Carlos Morales',
    ownerRole: 'Licensed Maintenance Tech',
    zoneId: 'cedar-park',
    availability: 'Sat mornings & weekday emergencies',
    safeHandoff: 'Two-neighbor check-in or daytime visit; parts reimbursed at receipt cost only.',
    borrowCount: 16,
    messages: [
      {
        id: 'm-105',
        author: 'Carlos Morales',
        zoneName: 'Cedar Park West',
        timestamp: '4 days ago',
        text: 'Si tienen una fuga debajo del fregadero o un inodoro que no deja de correr agua, envíenme una foto y paso a revisar.',
        originalLanguage: 'Spanish',
      },
    ],
  },
  {
    id: 'res-wheelchair',
    title: 'Folding Transport Wheelchair & Adjustable Crutches',
    category: 'Medical',
    description:
      'Lightweight folding wheelchair with swing-away footrests and a pair of height-adjustable aluminum underarm crutches for post-surgery recovery or visiting elderly relatives.',
    ownerName: 'Hannah Lindqvist',
    ownerRole: 'Physical Therapist',
    zoneId: 'linden-square',
    availability: 'Short-term loans up to 3 weeks',
    safeHandoff: 'Curbside trunk loading at Linden Elementary Courtyard.',
    borrowCount: 7,
    imageUrl: ASSET_IMAGES.medicalKit,
    emergencyReady: true,
    messages: [],
  },
  {
    id: 'res-hub-tools',
    title: 'Riverbend Shared Tool Library & Lawn Care Shed',
    category: 'Hub',
    description:
      'Verified community hub stocked with electric pressure washer, hedge trimmers, tile cutter, carpet cleaner, folding banquet tables, and bicycle repair stand. Free 7-day loans for Ward 4 residents.',
    ownerName: 'Riverbend Community Hub',
    ownerRole: 'Verified RWA & Civic Hub',
    zoneId: 'riverbend',
    availability: 'Wed–Sun, 9:00 AM – 6:00 PM',
    safeHandoff: 'Check out in person at Riverbend Hub desk with fuzzy zone card.',
    isVerifiedHub: true,
    borrowCount: 148,
    imageUrl: ASSET_IMAGES.communityHub,
    emergencyReady: true,
    messages: [],
  },
  {
    id: 'res-elder-care',
    title: 'Senior Check-Ins, Pharmacy Runs & Medical Portal Help',
    category: 'Care',
    description:
      'Volunteer neighbor support for seniors needing grocery/prescription pickups, telehealth appointment setup, or reading medication schedules clearly.',
    ownerName: 'Meera Subramanian',
    ownerRole: 'Community Care Volunteer',
    zoneId: 'oakridge-north',
    availability: 'Mon, Wed, Fri mornings',
    safeHandoff: 'First introduction with family contact or Oakridge RWA coordinator.',
    borrowCount: 28,
    emergencyReady: true,
    messages: [
      {
        id: 'm-108',
        author: 'Meera Subramanian',
        zoneName: 'Oakridge North',
        timestamp: 'Today, 8:20 AM',
        text: 'Heading to Cedar Pharmacy at 11 AM today if any homebound neighbor needs a prescription picked up.',
        originalLanguage: 'English',
      },
    ],
  },
  {
    id: 'res-inverter',
    title: '1000Wh Portable Battery Station & Solar Panel',
    category: 'Tool',
    description:
      'Silent lithium backup power station capable of keeping CPAP machines, Wi-Fi routers, phones, or mini medical fridges running during neighborhood power outages.',
    ownerName: 'Wei-Lin Zhang',
    ownerRole: 'Emergency Preparedness Lead',
    zoneId: 'maple-terrace',
    availability: 'Priority for medical power needs & outages',
    safeHandoff: 'Immediate handoff at Maple Gate Pavilion during outages.',
    borrowCount: 9,
    emergencyReady: true,
    messages: [],
  },
  {
    id: 'res-hub-library',
    title: 'Cedar Branch Library — Cooling Center, Wi-Fi & Textbook Bank',
    category: 'Hub',
    description:
      'Verified public hub providing air-conditioned/heated shelter during extreme weather, high-speed study desks, SAT/board exam prep books, and notary hours on Saturdays.',
    ownerName: 'Cedar Branch Public Library',
    ownerRole: 'Verified Civic Institution',
    zoneId: 'cedar-park',
    availability: 'Mon–Sat, 9:00 AM – 8:00 PM',
    safeHandoff: 'Open civic space; safe neutral meeting spot for peer-to-peer tool handoffs.',
    isVerifiedHub: true,
    borrowCount: 215,
    imageUrl: ASSET_IMAGES.communityHub,
    emergencyReady: true,
    messages: [],
  },
];

export const INITIAL_ISSUES: CommunityIssue[] = [
  {
    id: 'iss-water-drop',
    title: 'Low Water Pressure & Brown Tap Water near Oakridge North',
    category: 'Utilities',
    severity: 'High',
    status: 'Coordinator Assigned',
    zoneId: 'oakridge-north',
    reportCount: 7,
    updatedAt: '18 mins ago',
    actionableSummary:
      'Seven independent resident reports over the last 90 minutes indicate a sudden pressure drop and discolored tap water along the north Oakridge feeder line. Utility crew dispatched; residents advised to store drinking water and boil until pressure clears.',
    routedCoordinator: 'Ward 4 Water Liaison (Ramesh Iyer)',
    recommendedAction: 'Avoid running washing machines; boiled water advisory until 4:00 PM flush completes.',
    messages: [
      {
        id: 'im-1',
        author: 'Sonia Patel',
        zoneName: 'Oakridge North',
        timestamp: '42 mins ago',
        text: 'पानी का प्रेशर बहुत कम आ रहा है और थोड़ा मटमैला पानी है। क्या बाकी घरों में भी ऐसा है?',
        originalLanguage: 'Hindi',
      },
      {
        id: 'im-2',
        author: 'Ramesh Iyer (Water Liaison)',
        zoneName: 'Oakridge North',
        timestamp: '18 mins ago',
        text: 'Confirmed with Municipal Water Desk—valve maintenance on 4th Ave caused sediment shift. Flushing line now; clean pressure expected by 4:00 PM.',
        originalLanguage: 'English',
      },
    ],
  },
  {
    id: 'iss-streetlight',
    title: 'Two Consecutive Streetlights Out along Cedar Park Footpath',
    category: 'Safety',
    severity: 'Moderate',
    status: 'Active Triage',
    zoneId: 'cedar-park',
    reportCount: 4,
    updatedAt: '2 hours ago',
    actionableSummary:
      'Four evening commuters reported complete darkness on the pedestrian shortcut between Cedar Branch Library and the West bus stop after sunset. Ticket #CL-4082 filed with Civic Lighting Desk.',
    routedCoordinator: 'Civic Lighting Desk & Night Walk Watch',
    recommendedAction: 'Use the lit perimeter sidewalk after 6:30 PM until pole relay replacement tomorrow.',
    messages: [
      {
        id: 'im-3',
        author: 'Elena Vargas',
        zoneName: 'Cedar Park West',
        timestamp: '2 hours ago',
        text: 'Las dos lámparas cerca de la biblioteca llevan tres noches apagadas, está muy oscuro para volver del autobús.',
        originalLanguage: 'Spanish',
      },
    ],
  },
  {
    id: 'iss-stray-dog',
    title: 'Lost Small Golden Terrier Wearing Blue Collar near Maple Path',
    category: 'Pet Alert',
    severity: 'Moderate',
    status: 'Active Triage',
    zoneId: 'maple-terrace',
    reportCount: 3,
    updatedAt: '35 mins ago',
    actionableSummary:
      'Friendly small golden terrier with a faded blue nylon collar (no readable tag) spotted trotting near Maple Gate Pavilion. Currently resting safely with water inside the fenced pavilion courtyard.',
    routedCoordinator: 'Community Pet Watch (Lin Mei)',
    recommendedAction: 'Owner or anyone recognizing the dog can coordinate pickup at Maple Gate Pavilion.',
    messages: [
      {
        id: 'im-4',
        author: 'Lin Mei',
        zoneName: 'Maple Terrace',
        timestamp: '35 mins ago',
        text: '小狗很温顺，已经在凉亭喝水休息了。请附近丢狗的邻居联系我核对项圈特征。',
        originalLanguage: 'Mandarin Chinese',
      },
    ],
  },
  {
    id: 'iss-storm-drain',
    title: 'Clogged Corner Storm Drain Pooling Water before Rain',
    category: 'Streets',
    severity: 'Low',
    status: 'Coordinator Assigned',
    zoneId: 'linden-square',
    reportCount: 2,
    updatedAt: '5 hours ago',
    actionableSummary:
      'Fallen oak leaves have packed the grate on the south side of Linden Elementary crosswalk, creating ankle-deep puddles for school drop-off. Two volunteers signed up for a 20-minute rake clear before tonight’s rain.',
    routedCoordinator: 'Linden Street Stewards',
    recommendedAction: 'Needs one heavy-duty leaf rake and yard waste bags at 5:00 PM.',
    messages: [],
  },
];

export const INITIAL_EMERGENCY_ALERTS: EmergencyAlert[] = [
  {
    id: 'em-power',
    title: 'High-Wind Gust Advisory & Potential Feeder Outage (Tonight 8 PM – 2 AM)',
    type: 'Weather Advisory',
    severity: 'Advisory',
    zoneId: 'maple-terrace',
    updatedAt: 'Updated 25 mins ago',
    summary:
      'Forecast gusts up to 65 km/h may trigger temporary line trips across Maple Terrace and Oakridge North. Residents relying on CPAP or refrigerated medication can pre-reserve neighborhood portable power stations now.',
    coordinationHub: 'Oakridge RWA Community Porch & Cedar Branch Library',
    neededItems: ['1000Wh Battery Stations', 'USB Lanterns', 'Wellness Check Volunteers'],
    volunteersCheckedIn: 14,
  },
  {
    id: 'em-blood',
    title: 'Urgent O-Negative Blood Donor Coordination — St. Jude District Clinic',
    type: 'Blood Donor Request',
    severity: 'Urgent',
    zoneId: 'cedar-park',
    updatedAt: 'Updated 12 mins ago',
    summary:
      'Verified family request via Ward 4 Health Coordinator for two O-Negative whole blood donors within 24 hours at St. Jude District Clinic (1.4 km east). Ride-share volunteers are standing by for donors.',
    coordinationHub: 'Ward 4 Health Coordinator Desk',
    neededItems: ['Verified O-Negative Donors', 'Evening Ride Volunteer'],
    volunteersCheckedIn: 5,
  },
];

export const EXAMPLE_MATCH_PROMPTS = [
  {
    label: 'Ceiling fan reach',
    query: 'Need something sturdy to reach a high ceiling fan and replace a bulb this afternoon',
  },
  {
    label: 'Senior BP check',
    query: 'My grandmother is visiting and needs help checking her blood pressure cuff',
  },
  {
    label: 'High school trig',
    query: 'Looking for someone who can help my 10th grader with trigonometry before Friday',
  },
  {
    label: 'Mount heavy mirror',
    query: 'Need to find wall studs and screw in heavy brackets for a hallway mirror',
  },
];

export const SAMPLE_CONVERSATIONAL_LISTING =
  "Hi everyone, I'm Anita in Oakridge North. We just cleaned out our garage and I'm happy to lend out a heavy-duty wet/dry shop vacuum, a folding 8-foot banquet table for family events, and a set of bike tire pumps and patch kits. I'm also an accountant and can help seniors or students review basic tax forms on Sunday mornings.";

export const SAMPLE_SPAM_TEST =
  'URGENT CRYPTO SIGNAL!! Earn $4,500 daily from home!! Click bit.ly/fast-cash-now or WhatsApp +1-555-0199 for guaranteed forex returns!!';

export const SAMPLE_NOISY_CHAT = `[8:12 AM] Raj: Anyone else have almost zero water coming out of the kitchen tap near Oakridge park?
[8:14 AM] PromoBot99: 🔥 BUY DISCOUNT DESIGNER WATCHES 80% OFF DM ME 🔥
[8:16 AM] Maria: Sí! En Oakridge North el agua sale muy débil y un poco marrón desde las 8am.
[8:19 AM] Dev: Same here, building B water pressure dropped completely.
[8:23 AM] Auntie Mei: 公园东门路灯坏了两盏，昨晚散步差点绊倒，希望能尽快修好。
[8:27 AM] Sam: Also saw a small scruffy brown dog with a red bandana wandering near Linden crosswalk!`;
