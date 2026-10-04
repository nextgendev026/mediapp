# Mobile health-data controls

The patient and rider applications request the minimum Android permissions needed for their displayed features:

- internet access for authenticated API calls
- location access for an optional delivery pin and proof-of-delivery GPS stamp
- notification access for order and dispatch updates
- phone and SMS intents opened through the user-confirmed Android composer

The applications do not silently place calls, send SMS, read SMS, or capture clinical documents. USSD and SMS fallback actions open a system intent so the user can review and confirm the destination and content.

## Review checklist

- [ ] Release signing certificate and provisioning profile are managed outside source control.
- [ ] Android runtime permission rationale is visible in the user interface.
- [ ] Session tokens use platform secure storage.
- [ ] Screenshots are disabled for payment and clinical detail surfaces.
- [ ] Crash reporting excludes tokens, phone numbers, prescription data, and payment payloads.
- [ ] Rider proof-of-delivery media is uploaded over TLS to Kenyan MinIO.
- [ ] Low-data mode avoids large media and uses text-first fallbacks.
- [ ] The privacy notice and consent policy version are shown before PHI processing.
