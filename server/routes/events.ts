import { Router, Request, Response } from 'express';
import { inMemoryStore, isConnectedToMongo } from '../db';
import { EventModel } from '../models/Event';

const router = Router();

const eventStringLimits: Record<string, number> = {
  id: 100,
  title: 150,
  tagline: 500,
  category: 100,
  date: 100,
  time: 50,
  location: 200,
  venueName: 200,
  imageUrl: 2048,
  organizerName: 150,
  organizerStellarAddress: 100,
};
const allowedEventFields = new Set([...Object.keys(eventStringLimits), 'royaltyPercentage', 'isFeatured', 'tiers']);
const allowedTierFields = new Set(['id', 'name', 'priceUSD', 'priceNGN', 'priceXLM', 'perks', 'totalAvailable', 'remaining']);

export function validateEventPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Event payload must be an object.';

  const event = payload as Record<string, unknown>;
  const unknownEventFields = Object.keys(event).filter((field) => !allowedEventFields.has(field));
  if (unknownEventFields.length) return `Unknown event field: ${unknownEventFields[0]}.`;

  for (const [field, maxLength] of Object.entries(eventStringLimits)) {
    const value = event[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > maxLength)) {
      return `${field} must be a string of at most ${maxLength} characters.`;
    }
  }
  if (typeof event.title !== 'string' || !event.title.trim()) return 'A title is required.';
  if (typeof event.date !== 'string' || !event.date.trim() || Number.isNaN(Date.parse(event.date))) {
    return 'A valid event date is required.';
  }
  if (typeof event.imageUrl === 'string' && event.imageUrl) {
    try {
      const imageUrl = new URL(event.imageUrl);
      if (!['http:', 'https:'].includes(imageUrl.protocol)) return 'imageUrl must use HTTP or HTTPS.';
    } catch {
      return 'imageUrl must be a valid URL.';
    }
  }
  if (event.royaltyPercentage !== undefined &&
      (typeof event.royaltyPercentage !== 'number' || !Number.isFinite(event.royaltyPercentage) || event.royaltyPercentage < 0 || event.royaltyPercentage > 100)) {
    return 'royaltyPercentage must be a number between 0 and 100.';
  }
  if (event.isFeatured !== undefined && typeof event.isFeatured !== 'boolean') return 'isFeatured must be a boolean.';
  if (event.tiers !== undefined) {
    if (!Array.isArray(event.tiers) || event.tiers.length > 100) return 'tiers must be an array of at most 100 items.';
    for (const [index, tierValue] of event.tiers.entries()) {
      if (!tierValue || typeof tierValue !== 'object' || Array.isArray(tierValue)) return `tiers[${index}] must be an object.`;
      const tier = tierValue as Record<string, unknown>;
      const unknownTierFields = Object.keys(tier).filter((field) => !allowedTierFields.has(field));
      if (unknownTierFields.length) return `Unknown tier field: ${unknownTierFields[0]}.`;
      if (tier.id !== undefined && (typeof tier.id !== 'string' || tier.id.length > 100)) {
        return `tiers[${index}].id must be a string of at most 100 characters.`;
      }
      if (typeof tier.name !== 'string' || !tier.name.trim() || tier.name.length > 100) {
        return `tiers[${index}].name must be a string of at most 100 characters.`;
      }
      for (const priceField of ['priceUSD', 'priceNGN', 'priceXLM']) {
        const price = tier[priceField];
        if (price !== undefined && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
          return `tiers[${index}].${priceField} must be a non-negative number.`;
        }
      }
      if (tier.perks !== undefined && (!Array.isArray(tier.perks) || tier.perks.length > 30 || tier.perks.some((perk) => typeof perk !== 'string' || perk.length > 200))) {
        return `tiers[${index}].perks must contain at most 30 strings of at most 200 characters.`;
      }
      for (const capacityField of ['totalAvailable', 'remaining']) {
        const capacity = tier[capacityField];
        if (capacity !== undefined && (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 0 || capacity > 1_000_000)) {
          return `tiers[${index}].${capacityField} must be a non-negative integer.`;
        }
      }
      if (typeof tier.totalAvailable === 'number' && typeof tier.remaining === 'number' && tier.remaining > tier.totalAvailable) {
        return `tiers[${index}].remaining cannot exceed totalAvailable.`;
      }
    }
  }
  return null;
}

const INITIAL_EVENTS = [
  {
    id: 'evt-001',
    title: 'DRIPS Soroban Web3 Hack Summit 2026',
    tagline: 'Building the next generation of decentralized infrastructure on Stellar Soroban.',
    category: 'Tech & Crypto',
    date: 'August 18-20, 2026',
    time: '09:00 AM WAT',
    location: 'Lagos, Nigeria',
    venueName: 'Landmark Event Centre, Victoria Island',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    organizerName: 'DRIPS Protocol Foundation',
    organizerStellarAddress: 'GCSOROBANORGANIZER2026EVENTLINKMINTKEYSTELLAR101',
    royaltyPercentage: 5,
    isFeatured: true,
    tiers: [
      {
        id: 'tier-01',
        name: 'General Access',
        priceUSD: 25,
        priceNGN: 37500,
        priceXLM: 180,
        perks: ['Full Conference Access', 'Swag Bag', 'On-Chain POAP NFT', 'Networking Lounge'],
        totalAvailable: 500,
        remaining: 142,
      },
      {
        id: 'tier-02',
        name: 'VIP Builder Pass',
        priceUSD: 85,
        priceNGN: 127500,
        priceXLM: 600,
        perks: ['VIP Front Row Seats', 'Exclusive Founder & VC Dinner', '1-on-1 Grant Mentorship', 'Custom Stellar NFT Badge'],
        totalAvailable: 100,
        remaining: 18,
      },
    ],
  },
  {
    id: 'evt-002',
    title: 'Afrobeats On-Chain Fest 2026',
    tagline: 'The world’s first Web3 music festival powered by Stellar smart ticket passes.',
    category: 'Music & Concerts',
    date: 'September 12, 2026',
    time: '05:00 PM WAT',
    location: 'Lagos, Nigeria',
    venueName: 'Eko Atlantic Concert Arena',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    organizerName: 'AfroSound Web3 Labs',
    organizerStellarAddress: 'GAFROBEATSMUSICEVENTLINKORGANIZERSTELLAR2026',
    royaltyPercentage: 7.5,
    isFeatured: true,
    tiers: [
      {
        id: 'tier-03',
        name: 'Early Bird Regular',
        priceUSD: 15,
        priceNGN: 22500,
        priceXLM: 110,
        perks: ['General Admission Entry', 'Festival Wristband', 'Collectible Soroban Badge'],
        totalAvailable: 1000,
        remaining: 412,
      },
    ],
  },
];

// Seed initial events into memory
INITIAL_EVENTS.forEach((evt) => {
  inMemoryStore.events.set(evt.id, evt);
});

export async function persistEvent(event: any, saveToDatabase?: () => Promise<unknown>): Promise<void> {
  if (saveToDatabase) await saveToDatabase();
  inMemoryStore.events.set(event.id, event);
}

/**
 * GET /api/events - Retrieve all events live from database
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const memoryList = Array.from(inMemoryStore.events.values());

    if (isConnectedToMongo) {
      const dbEvents = await EventModel.find().sort({ createdAt: -1 });
      const combinedMap = new Map();
      memoryList.forEach((e) => combinedMap.set(e.id, e));
      dbEvents.forEach((e) => combinedMap.set(e.id, e.toObject()));
      return res.json(Array.from(combinedMap.values()));
    }

    return res.json(memoryList);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

/**
 * POST /api/events - Create new event & save persistently to database
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const eventData = req.body;
    const validationError = validateEventPayload(eventData);
    if (validationError) return res.status(400).json({ error: validationError });

    const eventId = eventData.id || `evt-${Math.floor(100000 + Math.random() * 900000)}`;
    const fullEvent = {
      ...eventData,
      id: eventId,
      createdAt: new Date().toISOString(),
    };

    try {
      await persistEvent(
        fullEvent,
        isConnectedToMongo ? () => new EventModel(fullEvent).save() : undefined,
      );
    } catch (dbErr) {
      console.warn('MongoDB event save failed:', dbErr);
      return res.status(503).json({ error: 'Event persistence failed. Please retry.' });
    }

    console.log(`[DB EVENT SAVED] Created event "${fullEvent.title}" (ID: ${eventId})`);

    return res.status(201).json({
      message: 'Event created successfully.',
      event: fullEvent,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save event' });
  }
});

export default router;
