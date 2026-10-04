import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_ROLES,
  LANGUAGES,
  GENDERS,
  PRODUCT_CATEGORIES,
  PRESCRIPTION_STATUSES,
  SHA_CLAIM_STATUSES,
  CONSULTATION_STATUSES,
  CONSULTATION_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  DELIVERY_STATUSES,
  DELIVERY_METHODS,
  TRANSACTION_STATUSES,
  TRANSACTION_PROVIDERS,
  CONSENT_TYPES,
  AUDIT_ACTIONS,
  AUDIT_PURPOSES,
  VISIT_STAGES,
  isVisitStage,
  isForwardVisitMove,
  nextVisitStage,
  canEnterVisitStage,
  KENYA_COUNTIES,
  KENYAN_PHONE_REGEX,
  isKenyanPhone,
  normalizeKenyanPhone,
  formatKES,
  createOrderNumber,
  isTerminalPaymentStatus,
} from './index';

describe('USER_ROLES', () => {
  it('contains expected roles', () => {
    assert.deepEqual([...USER_ROLES], ['patient', 'provider', 'pharmacist', 'admin', 'rider']);
  });

  it('has 5 roles', () => {
    assert.equal(USER_ROLES.length, 5);
  });
});

describe('LANGUAGES', () => {
  it('contains expected languages', () => {
    assert.deepEqual([...LANGUAGES], ['en', 'sw']);
  });
});

describe('GENDERS', () => {
  it('contains expected genders', () => {
    assert.deepEqual([...GENDERS], ['male', 'female', 'other', 'prefer_not_to_say']);
  });
});

describe('PRODUCT_CATEGORIES', () => {
  it('contains expected categories', () => {
    assert.deepEqual([...PRODUCT_CATEGORIES], ['prescription', 'otc', 'device', 'supplement']);
  });
});

describe('PRESCRIPTION_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...PRESCRIPTION_STATUSES], ['pending', 'approved', 'dispensed', 'cancelled', 'expired']);
  });
});

describe('SHA_CLAIM_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...SHA_CLAIM_STATUSES], ['not_submitted', 'submitted', 'approved', 'rejected']);
  });
});

describe('CONSULTATION_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...CONSULTATION_STATUSES], ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']);
  });
});

describe('CONSULTATION_TYPES', () => {
  it('contains expected types', () => {
    assert.deepEqual([...CONSULTATION_TYPES], ['video', 'audio', 'chat']);
  });
});

describe('PAYMENT_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...PAYMENT_STATUSES], ['pending', 'paid', 'failed', 'refunded', 'partially_refunded']);
  });
});

describe('PAYMENT_METHODS', () => {
  it('contains expected methods', () => {
    assert.deepEqual([...PAYMENT_METHODS], ['mpesa', 'airtel_money', 'pesalink', 'card', 'sha', 'cash']);
  });
});

describe('DELIVERY_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...DELIVERY_STATUSES], ['pending', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'failed', 'cancelled']);
  });
});

describe('DELIVERY_METHODS', () => {
  it('contains expected methods', () => {
    assert.deepEqual([...DELIVERY_METHODS], ['boda', 'pickup_point', 'clinic_collection']);
  });
});

describe('TRANSACTION_STATUSES', () => {
  it('contains expected statuses', () => {
    assert.deepEqual([...TRANSACTION_STATUSES], ['initiated', 'pending', 'succeeded', 'failed', 'reversed']);
  });
});

describe('TRANSACTION_PROVIDERS', () => {
  it('contains expected providers', () => {
    assert.deepEqual([...TRANSACTION_PROVIDERS], ['mpesa', 'airtel_money', 'pesalink', 'card', 'sha']);
  });
});

describe('CONSENT_TYPES', () => {
  it('contains expected types', () => {
    assert.deepEqual([...CONSENT_TYPES], [
      'phi_processing',
      'telehealth',
      'prescription_sharing',
      'marketing',
      'research',
      'data_sharing_third_party',
    ]);
  });
});

describe('AUDIT_ACTIONS', () => {
  it('contains expected actions', () => {
    assert.deepEqual([...AUDIT_ACTIONS], ['READ', 'CREATE', 'UPDATE', 'DELETE', 'DISPENSE', 'EXPORT']);
  });
});

describe('AUDIT_PURPOSES', () => {
  it('contains expected purposes', () => {
    assert.deepEqual([...AUDIT_PURPOSES], ['treatment', 'payment', 'audit', 'admin']);
  });
});

describe('VISIT_STAGES', () => {
  it('covers the full clinic pathway in order', () => {
    assert.deepEqual(
      [...VISIT_STAGES],
      ['front_desk', 'triage', 'consultation', 'lab_imaging', 'diagnosis', 'prescription', 'checkout', 'complete']
    );
  });

  it('recognises stage values', () => {
    assert.equal(isVisitStage('triage'), true);
    assert.equal(isVisitStage('unknown'), false);
  });

  it('moves forward only', () => {
    assert.equal(isForwardVisitMove('front_desk', 'triage'), true);
    assert.equal(isForwardVisitMove('triage', 'front_desk'), false);
    assert.equal(isForwardVisitMove('triage', 'triage'), false);
  });

  it('walks the pathway one stage at a time', () => {
    assert.equal(nextVisitStage('front_desk'), 'triage');
    assert.equal(nextVisitStage('checkout'), 'complete');
    assert.equal(nextVisitStage('complete'), null);
  });

  it('gates stages by role', () => {
    assert.equal(canEnterVisitStage('admin', 'front_desk'), true);
    assert.equal(canEnterVisitStage('provider', 'front_desk'), false);
    assert.equal(canEnterVisitStage('pharmacist', 'checkout'), true);
    assert.equal(canEnterVisitStage('pharmacist', 'diagnosis'), false);
  });
});

describe('KENYA_COUNTIES', () => {
  it('contains 47 counties', () => {
    assert.equal(KENYA_COUNTIES.length, 47);
  });

  it('contains Nairobi', () => {
    assert.ok(KENYA_COUNTIES.includes('Nairobi'));
  });

  it('contains Mombasa', () => {
    assert.ok(KENYA_COUNTIES.includes('Mombasa'));
  });

  it('contains Kisumu', () => {
    assert.ok(KENYA_COUNTIES.includes('Kisumu'));
  });

  it('contains all counties as strings', () => {
    for (const county of KENYA_COUNTIES) {
      assert.equal(typeof county, 'string');
    }
  });
});

describe('KENYAN_PHONE_REGEX', () => {
  it('matches valid phone numbers', () => {
    assert.equal(KENYAN_PHONE_REGEX.test('0712345678'), true);
    assert.equal(KENYAN_PHONE_REGEX.test('0112345678'), true);
    assert.equal(KENYAN_PHONE_REGEX.test('+254712345678'), true);
    assert.equal(KENYAN_PHONE_REGEX.test('254712345678'), true);
  });

  it('does not match invalid phone numbers', () => {
    assert.equal(KENYAN_PHONE_REGEX.test('071234567'), false);
    assert.equal(KENYAN_PHONE_REGEX.test('07123456789'), false);
    assert.equal(KENYAN_PHONE_REGEX.test('0212345678'), false);
    assert.equal(KENYAN_PHONE_REGEX.test(''), false);
  });
});

describe('isKenyanPhone', () => {
  it('returns true for valid 07XX numbers', () => {
    assert.equal(isKenyanPhone('0712345678'), true);
  });

  it('returns true for valid 01XX numbers', () => {
    assert.equal(isKenyanPhone('0112345678'), true);
  });

  it('returns true for +254 prefix', () => {
    assert.equal(isKenyanPhone('+254712345678'), true);
  });

  it('returns true for 254 prefix', () => {
    assert.equal(isKenyanPhone('254712345678'), true);
  });

  it('returns false for invalid numbers', () => {
    assert.equal(isKenyanPhone('071234567'), false);
    assert.equal(isKenyanPhone('07123456789'), false);
    assert.equal(isKenyanPhone(''), false);
    assert.equal(isKenyanPhone('abc'), false);
  });

  it('trims whitespace before validating', () => {
    assert.equal(isKenyanPhone('  0712345678  '), true);
  });
});

describe('normalizeKenyanPhone', () => {
  it('normalizes 07XX to +254 format', () => {
    assert.equal(normalizeKenyanPhone('0712345678'), '+254712345678');
  });

  it('normalizes 01XX to +254 format', () => {
    assert.equal(normalizeKenyanPhone('0112345678'), '+254112345678');
  });

  it('keeps +254 prefix', () => {
    assert.equal(normalizeKenyanPhone('+254712345678'), '+254712345678');
  });

  it('normalizes 254 prefix to +254', () => {
    assert.equal(normalizeKenyanPhone('254712345678'), '+254712345678');
  });

  it('strips non-digit characters', () => {
    assert.equal(normalizeKenyanPhone('0712 345 678'), '+254712345678');
  });
});

describe('formatKES', () => {
  it('formats basic amounts', () => {
    assert.equal(formatKES(1000), 'KES 1,000');
    assert.equal(formatKES(500), 'KES 500');
  });

  it('formats zero', () => {
    assert.equal(formatKES(0), 'KES 0');
  });

  it('formats negative amounts', () => {
    assert.equal(formatKES(-1000), 'KES -1,000');
  });

  it('formats large numbers', () => {
    assert.equal(formatKES(1000000), 'KES 1,000,000');
  });
});

describe('createOrderNumber', () => {
  it('creates order number with default date and sequence', () => {
    const orderNum = createOrderNumber();
    assert.match(orderNum, /^AFY-\d{4}-\d{6}$/);
  });

  it('creates order number with custom date', () => {
    const date = new Date('2025-06-15T00:00:00Z');
    const orderNum = createOrderNumber(date, 42);
    assert.equal(orderNum, 'AFY-2025-000042');
  });

  it('pads sequence to 6 digits', () => {
    const date = new Date('2025-01-01T00:00:00Z');
    assert.equal(createOrderNumber(date, 1), 'AFY-2025-000001');
    assert.equal(createOrderNumber(date, 999999), 'AFY-2025-999999');
  });

  it('uses UTC year', () => {
    const date = new Date('2025-12-31T23:59:59Z');
    const orderNum = createOrderNumber(date, 1);
    assert.equal(orderNum, 'AFY-2025-000001');
  });
});

describe('isTerminalPaymentStatus', () => {
  it('returns true for succeeded', () => {
    assert.equal(isTerminalPaymentStatus('succeeded'), true);
  });

  it('returns true for failed', () => {
    assert.equal(isTerminalPaymentStatus('failed'), true);
  });

  it('returns true for reversed', () => {
    assert.equal(isTerminalPaymentStatus('reversed'), true);
  });

  it('returns false for pending', () => {
    assert.equal(isTerminalPaymentStatus('pending'), false);
  });

  it('returns false for initiated', () => {
    assert.equal(isTerminalPaymentStatus('initiated'), false);
  });
});
