export type PaymentProvider = 'stripe' | 'flutterwave' | 'stellar';
export type TicketStatus = 'claimable' | 'valid' | 'used' | 'proof_nft';

export interface IssuedTicket {
  id: string;
  ticketHash: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  paymentProvider: PaymentProvider;
  amountPaid: string;
  custodialPublicKey: string;
  custodialSecretKey?: string;
  currentOwnerAddress: string;
  status: TicketStatus;
  stellarTxHash: string;
  sorobanContractId: string;
  claimCode: string;
  claimUrl: string;
  isListedResale: boolean;
  resalePriceUSD?: number;
  mintTimestamp: string;
  redeemTimestamp?: string;
  poapMetadata?: {
    badgeName: string;
    description: string;
    imageUrl: string;
  };
}