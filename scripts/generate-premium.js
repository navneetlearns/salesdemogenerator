/**
 * Premium Demo Generator (Path C)
 * Reads journey JSON data and generates standalone premium HTML files
 * with multi-turn WhatsApp conversations, sidebar navigation, inline CSS.
 *
 * Usage: node scripts/generate-premium.js [journey-name]
 *   e.g. node scripts/generate-premium.js order_to_cash
 *   or:  node scripts/generate-premium.js all
 */

const fs = require('fs');
const path = require('path');

const BRANDS = {
  jk_cement: {
    name: 'JK Cement',
    industry: 'Building Materials — Cement & Allied Products',
    color: '#003D7A',
    colorDark: '#002856',
    accent: '#C1A56C',
    logoBase64: '' // Will be read from file
  }
};

// Step conversations for each journey
// These simulate multi-turn WhatsApp chats
const CONVERSATIONS = {
  order_to_cash: {
    1: {
      title: 'Self Service Ordering',
      type: 'Order Placement',
      screens: [
        {
          label: 'Screen 1 · Self Service Menu',
          type: 'Session Interactive Message — Reply Button',
          desc: 'JK Cement sends a WhatsApp session message with the self-service ordering menu. Retailers can order directly without calling the distributor.',
          messages: [
            { from: 'sender', template: { title: '🛒 Self Service Ordering', body: 'Your self-service portal is now active. Browse our full catalog of JK Cement products — OPC 53 Grade, PPC, PSC, and more. Order anytime, get priority dispatch.', time: '9:21 AM', btn: '📋 Open Order Menu' } }
          ]
        },
        {
          label: 'Screen 2 · Order Menu',
          type: 'Interactive List — Single Select',
          desc: 'Retailer opens the self-service menu showing key actions — Place Order, View Past Orders, Track Delivery, and Payment Status.',
          messages: [
            { from: 'system', text: 'JK Cement Self Service' },
            { from: 'receiver', text: 'I need to place a new order for OPC 53 Grade. We\'re running low on stock.' },
            { from: 'sender', text: 'Sure! Please share your dealer code and the quantity you need. Our current dispatch time is 24-48 hours.' },
            { from: 'receiver', text: 'Dealer code JKC-D0432. I need 500 bags of OPC 53 Grade and 200 bags of PPC.' }
          ]
        },
        {
          label: 'Screen 3 · Live Inventory Check',
          type: 'Order Processing',
          desc: 'System checks real-time inventory at the nearest JK Cement depot and confirms availability for the requested quantities.',
          messages: [
            { from: 'sender', text: '✅ Stock confirmed at JK Cement Depot — Gotan (50 km from your location).\n\n📦 OPC 53 Grade: 500 bags available at ₹350/bag\n📦 PPC: 200 bags available at ₹320/bag\n\nTotal: ₹2,39,000 (incl. GST ₹28,680)\n\nShall we proceed with this order?' },
            { from: 'receiver', text: 'Yes, please proceed. Confirm the order.' },
            { from: 'sender', text: '✅ Order JKC-2026-0417 created successfully!\n\nYou will receive the order confirmation and invoice shortly. Estimated dispatch: Tomorrow 8:00 AM.' }
          ]
        }
      ]
    },
    2: {
      title: 'Catalog Browse & Order',
      type: 'Product Selection',
      screens: [
        {
          label: 'Screen 1 · Product Catalog',
          type: 'Product Listing',
          desc: 'JK Cement product catalog with detailed specifications, pricing, and availability for all cement grades.',
          messages: [
            { from: 'system', text: '📋 JK Cement Product Catalog 2026' },
            { from: 'receiver', text: 'Show me your PPC and Composite Cement options. I want to compare prices.' },
            { from: 'sender', text: 'Here are our current offerings:\n\n🏗️ OPC 53 Grade — ₹350/bag\n  › Best for RCC structures, high early strength\n  › IS 12269 compliant\n\n🏗️ PPC — ₹320/bag\n  › Durable, eco-friendly with fly ash\n  › IS 1489 compliant\n\n🏗️ Composite Cement — ₹340/bag\n  › Blended for superior workability\n  › IS 16415 compliant' }
          ]
        },
        {
          label: 'Screen 2 · Cart & Checkout',
          type: 'Interactive Order Form',
          desc: 'Retailer adds products to cart, reviews quantities, and proceeds to checkout with GST calculation.',
          messages: [
            { from: 'receiver', text: 'I\'ll take 500 bags of OPC 53 and 150 bags of Composite Cement.' },
            { from: 'sender', text: '🛒 Order Summary:\n\nOPC 53 Grade × 500 = ₹1,75,000\nComposite Cement × 150 = ₹51,000\nSubtotal: ₹2,26,000\nGST (12%): ₹27,120\nTotal: ₹2,53,120\n\nDelivery to: Ganesh Traders, Jodhpur\nExpected dispatch: 14 Jun 2026\n\nConfirm order?' },
            { from: 'receiver', text: 'Confirmed. Please process the order.' }
          ]
        }
      ]
    },
    3: {
      title: 'AI Order Capture',
      type: 'AI-Assisted Ordering',
      screens: [
        {
          label: 'Screen 1 · AI Order Initiation',
          type: 'AI WhatsApp Chat',
          desc: 'ZoAi, JK Cement\'s AI assistant, engages the retailer to capture orders conversationally, understanding natural language inputs.',
          messages: [
            { from: 'sender', text: '👋 Hello! I\'m ZoAi, your JK Cement ordering assistant. I see you usually order on the 15th. Would you like to place your monthly order now?' },
            { from: 'receiver', text: 'Yes, I need 600 bags of OPC 53 this time. Festival season coming up.' },
            { from: 'sender', text: 'Great! I notice you\'re ordering 100 more bags than last month. Shall I offer you our volume discount? 600+ bags gets 2% off — saves you ₹4,200!' },
            { from: 'receiver', text: 'That sounds good. Apply the discount and proceed.' }
          ]
        },
        {
          label: 'Screen 2 · AI Order Summary',
          type: 'Confirmation',
          desc: 'ZoAi presents a complete order summary with pricing breakdown, delivery estimate, and scheme applicability.',
          messages: [
            { from: 'sender', text: '✅ Order JKC-2026-0422 confirmed!\n\n📦 OPC 53 Grade × 600 bags = ₹2,10,000\n🎉 Volume Discount (2%) = −₹4,200\n💰 Net: ₹2,05,800\n🚚 Delivery: 16-17 Jun 2026\n📍 Location: Ganesh Traders, Jodhpur\n\nYour loyalty points: 4,200 (🏆 Gold Tier)\n\nThank you for choosing JK Cement!' }
          ]
        }
      ]
    },
    4: {
      title: 'Back Office Order Fulfilment',
      type: 'Fulfillment Processing',
      screens: [
        {
          label: 'Screen 1 · Order Processing Dashboard',
          type: 'Back Office View',
          desc: 'JK Cement back office team receives the order and begins processing — inventory allocation, delivery slot booking, and invoice generation.',
          messages: [
            { from: 'system', text: '📋 Back Office — Order Fulfilment Dashboard' },
            { from: 'sender', text: 'Order JKC-2026-0422 assigned to Warehouse — Gotan Depot.\n\n✅ Inventory allocated: 600 bags OPC 53\n✅ Delivery vehicle assigned: Truck RJ-27-GB-4422\n⏳ Invoice generation in progress\n\nEstimated dispatch: Tomorrow 6:00 AM' },
            { from: 'receiver', text: 'Can I get the delivery between 10 AM and 12 PM? I have a small unloading bay.' }
          ]
        },
        {
          label: 'Screen 2 · Delivery Slot Confirmation',
          type: 'Schedule',
          desc: 'Back office confirms delivery slot based on retailer preference and availability.',
          messages: [
            { from: 'sender', text: 'Slot confirmed for 17 Jun, 10:00-11:30 AM.\n\nDriver: Ramesh (+91-98765-43210)\nTruck: RJ-27-GB-4422 (40 ft container)\n\nYou\'ll receive live tracking once dispatched.' }
          ]
        }
      ]
    },
    5: {
      title: 'Order Confirmed Notification',
      type: 'Notification',
      screens: [
        {
          label: 'Screen 1 · Order Confirmation',
          type: 'WhatsApp Notification',
          desc: 'Retailer receives a detailed order confirmation notification with all relevant details, pricing, and tracking info.',
          messages: [
            { from: 'sender', template: { title: '✅ Order Confirmed — JKC-2026-0422', body: 'Dear Ganesh Traders,\n\nYour order has been confirmed and is being processed.\n\n📦 OPC 53 Grade × 600 bags\n💰 Total: ₹2,05,800 (after discount)\n🚚 Delivery: 17 Jun, 10:00-11:30 AM\n📍 JK Cement Depot — Gotan\n\nTrack your delivery in real-time: [Track Link]', time: '11:30 AM', btn: '📍 Track Delivery' } }
          ]
        }
      ]
    },
    6: {
      title: 'SAP Integration Architecture',
      type: 'System Integration',
      screens: [
        {
          label: 'Screen 1 · SAP Integration Flow',
          type: 'Architecture Diagram',
          desc: 'Order flows seamlessly from WhatsApp → ZoAi → JK Cement ERP (SAP S/4HANA) → Warehouse Management → Logistics. End-to-end digital integration.',
          messages: [
            { from: 'system', text: '🔄 WhatsApp ↔ SAP S/4HANA Integration' },
            { from: 'sender', text: 'Your order is flowing through our integrated system:\n\n📱 WhatsApp → ZoAi AI Layer\n⚙️ ZoAi → SAP S/4HANA (Order created: 0417)\n📦 SAP → WMS Gotan (Inventory allocated)\n🚚 WMS → Transport Management (Vehicle assigned)\n📄 SAP → Invoice (INV-2026-88923 generated)\n\nAll systems synced. No manual intervention needed.' },
            { from: 'receiver', text: 'Impressive! So I can track this in real-time across all systems?' },
            { from: 'sender', text: 'Exactly! You get WhatsApp notifications at every stage, and your dealer portal shows the full lifecycle — from order to delivery to payment.' }
          ]
        }
      ]
    },
    7: {
      title: 'Invoice & Dispatch',
      type: 'Invoice Processing',
      screens: [
        {
          label: 'Screen 1 · Invoice Generated',
          type: 'Invoice Notification',
          desc: 'System generates e-invoice compliant with GST regulations and shares it with the retailer via WhatsApp.',
          messages: [
            { from: 'sender', text: '📄 Invoice INV-2026-88923 generated.\n\n⏳ Dispatch in progress — loading at Gotan Depot.' },
            { from: 'sender', template: { title: '🧾 Tax Invoice INV-2026-88923', body: 'JK Cement Ltd.\nGST: 08AACCJ1234B1Z5\n\nBuyer: Ganesh Traders, Jodhpur\nGST: 08ABCDE1234F1Z5\n\nOPC 53 Grade × 600 @ ₹350 = ₹2,10,000\nDiscount (2%) = −₹4,200\nSGST (6%): ₹12,348\nCGST (6%): ₹12,348\n\nTotal: ₹2,30,496\n\nDue Date: 17 Jul 2026', time: '6:15 AM', btn: '📥 Download Invoice' } }
          ]
        },
        {
          label: 'Screen 2 · Dispatch Notification',
          type: 'Logistics Update',
          desc: 'Truck dispatched with live tracking link shared to the retailer.',
          messages: [
            { from: 'sender', text: '🚛 Truck RJ-27-GB-4422 dispatched from Gotan Depot!\n\n📍 Live tracking: [Google Maps Link]\n👤 Driver: Ramesh (+91-98765-43210)\n⏱️ ETA: 10:45 AM\n\nYou will receive a call 30 min before arrival.' }
          ]
        }
      ]
    },
    8: {
      title: 'Cash Discount & Payment Reminder',
      type: 'Payment',
      screens: [
        {
          label: 'Screen 1 · Early Payment Offer',
          type: 'Payment Incentive',
          desc: 'JK Cement offers a 2% cash discount if payment is made within 7 days instead of the standard 30-day credit period.',
          messages: [
            { from: 'sender', text: '💡 Pay early and save!\n\nInvoice INV-2026-88923: ₹2,30,496\nDue: 17 Jul 2026\n\n🎉 Early Payment Offer:\nPay by 24 Jun → 2% discount\nPay only ₹2,25,886\n\nSave ₹4,610!' },
            { from: 'receiver', text: 'That\'s a good deal. Let me check my cash flow and confirm by tomorrow.' },
            { from: 'sender', text: 'Sure! Just reply PAY to confirm. The offer is valid until 24 Jun 2026.' }
          ]
        }
      ]
    },
    9: {
      title: 'Payment Received',
      type: 'Payment Confirmation',
      screens: [
        {
          label: 'Screen 1 · Payment Confirmation',
          type: 'Payment Receipt',
          desc: 'Payment received and confirmed. Both retailer and JK Cement get instant reconciliation.',
          messages: [
            { from: 'sender', text: '✅ Payment Received!\n\nInvoice INV-2026-88923\nAmount: ₹2,25,886 (incl. early payment discount)\nDate: 22 Jun 2026\nMode: UPI — Google Pay\nUTR: HDFC123456789\n\nThank you for your prompt payment, Ganesh Traders! 🙏' },
            { from: 'receiver', text: 'Thank you! The early discount really helped. Looking forward to next month\'s order.' },
            { from: 'sender', text: 'Your Gold Tier loyalty points have been updated: 5,200 points. You\'re just 800 points away from Platinum Tier with additional 3% discount on all orders!' }
          ]
        }
      ]
    },
    10: {
      title: 'Credit Note & Ledger',
      type: 'Accounting',
      screens: [
        {
          label: 'Screen 1 · Credit Note Issued',
          type: 'Credit Document',
          desc: 'For the early payment discount, system generates a credit note reflecting the differential amount.',
          messages: [
            { from: 'sender', text: '📄 Credit Note CN-2026-0034 generated.\n\nReason: Early payment discount (2%)\nAmount: ₹4,610\n\nThis will reflect in your next order or can be withdrawn.' },
            { from: 'receiver', text: 'Please adjust it against my next order.' },
            { from: 'sender', text: 'Noted! ₹4,610 will be adjusted against your next purchase. Your current ledger balance shows ₹0 outstanding. ✅' }
          ]
        },
        {
          label: 'Screen 2 · Ledger Summary',
          type: 'Statement',
          desc: 'Complete ledger summary for the month showing all transactions — purchases, payments, discounts, and outstanding balance.',
          messages: [
            { from: 'sender', template: { title: '📊 Monthly Ledger — June 2026', body: 'Ganesh Traders (JKC-D0432)\n\nOP BAL: ₹12,500 (Cr)\n\n02 Jun — Purchase (OPC 53): ₹2,10,000\n02 Jun — Discount: −₹4,200\n17 Jun — Payment: −₹2,25,886\n17 Jun — Credit Note: ₹4,610\n\nCLOSING BAL: ₹0.00\n\nThank you for your business!', time: '6:30 PM', btn: '📥 Download Statement' } }
          ]
        }
      ]
    },
    11: {
      title: 'Self Service Navigation Menu',
      type: 'Navigation',
      screens: [
        {
          label: 'Screen 1 · Navigation Menu',
          type: 'Interactive Menu',
          desc: 'Retailer returns to the main self-service menu showing all available options — Order, Track, Pay, Schemes, Support.',
          messages: [
            { from: 'system', text: '🔵 JK Cement — Self Service Menu' },
            { from: 'receiver', text: 'Show me the menu options again.' },
            { from: 'sender', text: 'Here\'s your JK Cement Self Service Menu:\n\n1️⃣ 🛒 Place New Order\n2️⃣ 📍 Track Existing Order\n3️⃣ 💳 Make Payment / View Ledger\n4️⃣ 🏆 Loyalty Points & Schemes\n5� 📄 Download Invoices\n6️⃣ 🛠️ Raise a Ticket / Support\n\nReply with the number or tap below.' },
            { from: 'receiver', text: 'Let me check my loyalty points.' },
            { from: 'sender', text: '🏆 You\'re Gold Tier with 5,200 points!\n\nNext milestone: 6,000 points → Platinum (3% discount)\nRecent activity: +1,500 points this month\n\nKeep ordering to unlock more benefits!' }
          ]
        }
      ]
    }
  },
  field_ops_expense: {
    1: {
      title: 'Admin Creates Group',
      type: 'Group Setup',
      screens: [
        {
          label: 'Screen 1 · Admin Creates WhatsApp Group',
          type: 'Group Setup',
          desc: 'Admin creates a WhatsApp group for the field team — DSRs, ASMs, and managers added for daily coordination.',
          messages: [
            { from: 'system', text: '👥 JK Cement Field Team — Jodhpur Region' },
            { from: 'sender', text: 'Welcome to the JK Cement Field Operations group! This group will manage daily field activities, expense reporting, and real-time coordination.' },
            { from: 'receiver', text: 'Great! All 12 DSRs and 3 ASMs are added. Let\'s start from tomorrow morning.' }
          ]
        }
      ]
    },
    2: {
      title: 'ZoAi Capability Panel',
      type: 'AI Assistant',
      screens: [
        {
          label: 'Screen 1 · ZoAi Capabilities',
          type: 'AI Feature Overview',
          desc: 'ZoAi demonstrates its field ops capabilities — plan creation, travel optimization, expense tracking, and order capture.',
          messages: [
            { from: 'system', text: '🤖 ZoAi — Field Operations AI' },
            { from: 'sender', text: 'Hello team! I\'m ZoAi, your AI field operations assistant. I can help with:\n\n📋 Daily route planning\n📍 Travel & check-in tracking\n📸 Order capture via photo\n🧾 Expense claim filing\n📊 Real-time sales data\n\nReady to start? Type START to begin your day.' },
            { from: 'receiver', text: 'START. Ready for day plan.' }
          ]
        }
      ]
    },
    3: {
      title: 'Start Day & Clock-In',
      type: 'Attendance',
      screens: [
        {
          label: 'Screen 1 · Morning Clock-In',
          type: 'Geo-Tagged Attendance',
          desc: 'DSR clocks in with geotagged selfie and starts the day. ZoAi records attendance and provides day plan.',
          messages: [
            { from: 'sender', text: '🌅 Good morning! Please share your check-in photo to start your day.' },
            { from: 'receiver', text: '[Selfie sent] Checked in at JK Cement Godown, Jodhpur. 7:45 AM.' },
            { from: 'sender', text: '✅ Clock-in confirmed! Location: JK Cement Godown, Jodhpur. Time: 7:45 AM.\n\nYour day plan is ready. 8 retailer visits scheduled today in the Basni area.' }
          ]
        }
      ]
    },
    4: {
      title: 'Request Plan',
      type: 'Planning',
      screens: [
        {
          label: 'Screen 1 · Day Plan Shared',
          type: 'Route Plan',
          desc: 'ZoAi shares an optimized route plan with 8 retailer visits, travel time estimates, and expected order volumes.',
          messages: [
            { from: 'sender', text: '🗺️ Today\'s Route Plan — Basni, Jodhpur\n\n09:00 — Sharma General Store 📍2 km\n09:45 — Agarwal Cement 📍1.5 km\n10:30 — Goyal Construction 📍1 km\n11:15 — Meena Traders 📍3 km\n12:00 — Lunch Break 🍽️\n13:00 — Bansal Hardware 📍2 km\n14:00 — Jain Cement Agency 📍1 km\n15:00 — Gupta Building Materials 📍2.5 km\n16:00 — Joshi Traders 📍1 km\n\nTotal travel: 14 km\nExpected orders: ~800 bags' },
            { from: 'receiver', text: 'Plan looks good. Starting with Sharma General Store now.' }
          ]
        }
      ]
    },
    5: {
      title: 'Travel & Check-In',
      type: 'Field Visit',
      screens: [
        {
          label: 'Screen 1 · Check-In at Retailer',
          type: 'Geo-Fenced Check-in',
          desc: 'DSR arrives at the retailer location and checks in using geofencing. ZoAi records visit time and duration.',
          messages: [
            { from: 'sender', text: '📍 Check-in at Sharma General Store! 9:05 AM.\n\nRetailer: Rakesh Sharma\nContact: +91-98765-11223\nLast order: 15 May (400 bags OPC 53)' },
            { from: 'receiver', text: 'At the store now. Mr. Sharma is interested in the new PPC pricing.' },
            { from: 'sender', text: 'Great! Offer him the volume discount — 3% off on 200+ bags of PPC. Valid this month only.' }
          ]
        }
      ]
    },
    6: {
      title: 'Order Capture & Review',
      type: 'Order Taking',
      screens: [
        {
          label: 'Screen 1 · Order Capture',
          type: 'Order Entry',
          desc: 'DSR captures the order details on behalf of the retailer — product, quantity, pricing, and delivery instructions.',
          messages: [
            { from: 'sender', text: '📋 New Order — Sharma General Store\n\nProduct: PPC Cement\nQty: 250 bags\nPrice: ₹320/bag (after 3% discount: ₹310.40)\nTotal: ₹77,600\nDelivery: 20 Jun 2026\n\nConfirm order with Mr. Sharma?' },
            { from: 'receiver', text: 'Confirmed. Mr. Sharma has agreed. Processing the order.' },
            { from: 'sender', text: '✅ Order JKC-FO-2026-0812 created! E-invoice will be shared with the retailer.' }
          ]
        }
      ]
    },
    7: {
      title: 'Order Submit & Notify',
      type: 'Order Processing',
      screens: [
        {
          label: 'Screen 1 · Order Submitted',
          type: 'Confirmation',
          desc: 'Order is submitted to the back office for fulfillment. Retailer receives an instant WhatsApp confirmation.',
          messages: [
            { from: 'sender', text: '✅ Order JKC-FO-2026-0812 submitted to back office!\n\nInvoice INV-2026-88952 generated.\n\n📤 Order confirmation sent to Sharma General Store via WhatsApp.' },
            { from: 'receiver', text: 'Great! Moving to next visit — Agarwal Cement.' }
          ]
        }
      ]
    },
    8: {
      title: 'Competitor Insights',
      type: 'Market Intel',
      screens: [
        {
          label: 'Screen 1 · Competitor Report',
          type: 'Market Intelligence',
          desc: 'DSR records competitor activity — pricing, schemes, and market feedback via ZoAi\'s competitor intelligence module.',
          messages: [
            { from: 'sender', text: '📊 Competitor Intel — Agarwal Cement visit\n\nCompetitor: UltraTech\nActivity: Offering ₹10/bag discount on OPC 53\nRetailer feedback: Stocked 200 bags from them last week\n\nAny counter-strategy?' },
            { from: 'receiver', text: 'They\'re offering a discount. Can we match it?' },
            { from: 'sender', text: 'Approved! You can offer matching discount + extra loyalty points. Budget: up to ₹15/bag counter-offer.' }
          ]
        }
      ]
    },
    9: {
      title: 'Realtime ASM Communication',
      type: 'Team Chat',
      screens: [
        {
          label: 'Screen 1 · ASM Coordination',
          type: 'Live Chat',
          desc: 'DSR communicates with Area Sales Manager in real-time for approvals, pricing exceptions, and inventory queries.',
          messages: [
            { from: 'sender', text: 'ASM — urgent update needed at Goyal Construction.' },
            { from: 'receiver', text: 'What\'s the situation?' },
            { from: 'sender', text: 'They want 500 bags OPC 53 but need delivery tomorrow. Our Gotan depot shows 400 in stock.' },
            { from: 'receiver', text: 'I\'ll coordinate with Nagaur depot for 100 bags. ETA for transfer: 4 hours. Confirm the order.' }
          ]
        }
      ]
    },
    10: {
      title: 'PWA App Installation',
      type: 'App Install',
      screens: [
        {
          label: 'Screen 1 · PWA Promotion',
          type: 'Install Guide',
          desc: 'ZoAi promotes the JK Cement PWA app for streamlined field operations — offline-capable with all key features.',
          messages: [
            { from: 'sender', text: '📱 Install JK Cement Field Ops App!\n\nFeatures:\n✅ Offline order capture\n✅ Auto-sync when online\n✅ GPS route optimization\n✅ Expense filing with receipts\n✅ Real-time team dashboard\n\nTap INSTALL to add to your home screen.' },
            { from: 'receiver', text: 'Installed! Works great offline.' }
          ]
        }
      ]
    },
    11: {
      title: 'Field Ops Command Center',
      type: 'Dashboard',
      screens: [
        {
          label: 'Screen 1 · Command Center Dashboard',
          type: 'Manager View',
          desc: 'Field ops manager dashboard showing real-time team status — who is where, orders captured, expenses filed, and performance metrics.',
          messages: [
            { from: 'system', text: '📊 Field Ops Command Center — Live' },
            { from: 'sender', text: 'Team Status: 12 DSRs active\n\n✅ Clocked in: 12/12\n📍 Current visits: 8 in progress\n📦 Orders today: 32 (avg ₹85,000/order)\n💰 Total order value: ₹27.2 L\n🧾 Expenses filed: 8\n\nTop performer: DSR Rahul — ₹5.2L in orders today!' },
            { from: 'receiver', text: 'Great momentum! Keep it going team.' }
          ]
        }
      ]
    },
    12: {
      title: 'DSR Files Expense Claim',
      type: 'Expense Filing',
      screens: [
        {
          label: 'Screen 1 · Expense Submission',
          type: 'Expense Form',
          desc: 'DSR files daily expense claim with receipt photos — travel, lunch, mobile recharge, and miscellaneous expenses.',
          messages: [
            { from: 'sender', text: '🧾 Daily Expense Claim — 16 Jun 2026\n\n🚗 Travel: ₹450 (42 km @ ₹10.70/km)\n🍱 Lunch: ₹120\n📱 Mobile: ₹50\n🅿️ Parking: ₹30\n\nTotal: ₹650\n\nAttach receipt photos and submit.' },
            { from: 'receiver', text: '[Receipt photos attached] All expenses filed for today.' },
            { from: 'sender', text: '✅ Expense claim submitted! Claim ID: EXP-2026-0616-042.\n\nPending manager approval.' }
          ]
        }
      ]
    },
    13: {
      title: 'Manager Approval Queue',
      type: 'Approval',
      screens: [
        {
          label: 'Screen 1 · Approval Dashboard',
          type: 'Manager Review',
          desc: 'Manager reviews pending expense claims in the approval queue with ability to approve or reject with reason.',
          messages: [
            { from: 'system', text: '📋 Expense Approvals — 5 pending' },
            { from: 'sender', text: 'You have 5 pending expense claims:\n\n1️⃣ DSR Rahul — ₹850 (Travel + Meals) ⏳\n2️⃣ DSR Priya — ₹520 (Travel) ⏳\n3️⃣ DSR Amit — ₹1,200 (Travel + Stay) ⏳\n4️⃣ DSR Sunil — ₹380 (Local travel) ⏳\n5️⃣ DSR Vikas — ₹950 (Travel + Dinner) ⏳\n\nTap to review each.' }
          ]
        }
      ]
    },
    14: {
      title: 'Manager Reviews & Approves',
      type: 'Approval Action',
      screens: [
        {
          label: 'Screen 1 · Expense Approved',
          type: 'Approval Confirmation',
          desc: 'Manager reviews expense details with receipts and approves or rejects. DSR gets instant notification.',
          messages: [
            { from: 'sender', text: 'Reviewing DSR Rahul\'s claim EXP-2026-0616-042:\n\n🚗 Travel: ₹450 (42 km) ✅ Reasonable\n🍱 Lunch: ₹120 ✅ Within limit\n📱 Mobile: ₹50 ✅\n🅿️ Parking: ₹30 ✅\n\nTotal: ₹650\n\nDecision: Approve? (Y/N)' },
            { from: 'receiver', text: 'Y. Approved.' },
            { from: 'sender', text: '✅ DSR Rahul — Claim EXP-2026-0616-042 approved!\nAmount: ₹650\nCredited to: UPI (rahul@jkcement)\n\nNotification sent to DSR.' }
          ]
        }
      ]
    },
    15: {
      title: 'DSR Receives Notifications',
      type: 'Notification',
      screens: [
        {
          label: 'Screen 1 · Claim Approved Notification',
          type: 'Payment Confirmation',
          desc: 'DSR receives WhatsApp notification that expense claim is approved and amount is being credited.',
          messages: [
            { from: 'sender', text: '✅ Expense Approved & Credited!\n\nClaim ID: EXP-2026-0616-042\nAmount: ₹650\nStatus: Approved ✅\nCredit: UPI transfer initiated\nExpected in account: 30 min\n\nThank you for your service today! 🙏' },
            { from: 'receiver', text: 'Thank you! Received the amount. See you tomorrow.' },
            { from: 'sender', text: 'Great! Your day summary: 8 retailer visits, 5 orders captured (₹4.2L total), 1 expense claim approved. Excellent work! ⭐' }
          ]
        }
      ]
    }
  },
  automated_collections: {
    1: {
      title: 'Automated Payment Reminder',
      type: 'Auto-Notification',
      screens: [
        {
          label: 'Screen 1 · Payment Due Reminder',
          type: 'WhatsApp Notification',
          desc: 'ZoAi sends an automated payment reminder to the retailer for their upcoming due payment, with invoice details.',
          messages: [
            { from: 'sender', template: { title: '⏰ Payment Reminder — Due in 3 Days', body: 'Dear Ganesh Traders,\n\nInvoice INV-2026-88923 of ₹2,30,496 is due for payment on 17 Jul 2026.\n\n📄 Invoice: INV-2026-88923\n💰 Amount: ₹2,30,496\n📅 Due: 17 Jul 2026 (3 days)\n\nPay early & save 2% — pay only ₹2,25,886 if paid by 24 Jun.', time: '10:00 AM', btn: '💳 Pay Now' } }
          ]
        }
      ]
    },
    2: {
      title: 'Retailer Checks Invoices',
      type: 'Invoice Review',
      screens: [
        {
          label: 'Screen 1 · Invoice Details',
          type: 'Invoice Summary',
          desc: 'Retailer opens the invoice to verify details — product quantities, pricing, taxes, and due date before making payment.',
          messages: [
            { from: 'receiver', text: 'Let me check the invoice details first.' },
            { from: 'sender', text: '📄 INV-2026-88923 — JK Cement\n\nBuyer: Ganesh Traders (JKC-D0432)\n\nOPC 53 Grade × 600 @ ₹350 = ₹2,10,000\nLess: Volume Discount (2%) = −₹4,200\nSGST @ 6%: ₹12,348\nCGST @ 6%: ₹12,348\n\nTotal: ₹2,30,496\nDue Date: 17 Jul 2026\n\nEarly payment discount: 2% if paid by 24 Jun.' },
            { from: 'receiver', text: 'Everything looks correct. I\'ll schedule the payment.' }
          ]
        }
      ]
    },
    3: {
      title: 'AI Initiates PTP + Scheme',
      type: 'AI Negotiation',
      screens: [
        {
          label: 'Screen 1 · Promise to Pay Offer',
          type: 'AI Interaction',
          desc: 'ZoAi proactively engages the retailer with a Promise to Pay (PTP) option combined with a loyalty scheme unlock.',
          messages: [
            { from: 'sender', text: '💡 Good news! If you confirm your payment date today, you\'ll unlock:\n\n🏆 Double Loyalty Points on this payment (2×)\n🎁 Exclusive Diwali scheme early access\n✅ No late payment penalty\n\nWhen can you make the payment?' },
            { from: 'receiver', text: 'I can pay by the 20th of this month.' }
          ]
        }
      ]
    },
    4: {
      title: 'Retailer Declines Initial Date',
      type: 'Date Negotiation',
      screens: [
        {
          label: 'Screen 1 · Alternate Date Request',
          type: 'AI Negotiation',
          desc: 'Retailer needs more time — proposes an alternate payment date. ZoAi tries to negotiate an earlier commitment.',
          messages: [
            { from: 'sender', text: 'Thank you! However, to avail the Double Loyalty Points offer, payment needs to be confirmed within 7 days (by 24 Jun). Can you commit to an earlier date?' },
            { from: 'receiver', text: 'I can manage ₹1,00,000 by the 20th, and the remaining after my receivables clear by month end.' },
            { from: 'sender', text: 'That works! Let me set up a 2-part payment plan:\n\nPart 1: ₹1,00,000 by 20 Jun\nPart 2: ₹1,30,496 by 30 Jun\n\nBoth parts get the Double Loyalty Points benefit!' }
          ]
        }
      ]
    },
    5: {
      title: 'AI Asks Alternate Date',
      type: 'Negotiation',
      screens: [
        {
          label: 'Screen 1 · AI Proposes Options',
          type: 'Smart Suggestions',
          desc: 'ZoAi suggests optimal payment dates based on retailer\'s history, cash flow patterns, and current schemes.',
          messages: [
            { from: 'sender', text: 'Based on your payment history, you usually have higher cash flow on Fridays. Would Friday, 21 Jun work for the full payment?' },
            { from: 'receiver', text: 'Friday works. Let me confirm by Thursday.' },
            { from: 'sender', text: 'Perfect! I\'ll set a reminder for Thursday. If you confirm by 5 PM Thursday, I\'ll also add a special 100 bonus loyalty points on top! 🎁' }
          ]
        }
      ]
    },
    6: {
      title: 'Retailer Selects Friday',
      type: 'Confirmation',
      screens: [
        {
          label: 'Screen 1 · Payment Date Confirmed',
          type: 'Schedule',
          desc: 'Retailer confirms Friday as the payment date. ZoAi confirms and locks in the scheme benefits.',
          messages: [
            { from: 'receiver', text: 'Confirmed for Friday, 21 Jun. I\'ll make the full payment of ₹2,30,496.' },
            { from: 'sender', text: '✅ Promise to Pay confirmed!\n\n📅 Date: Friday, 21 Jun 2026\n💰 Amount: ₹2,30,496\n🏆 Double Loyalty Points: LOCKED ✅\n🎁 Diwali Scheme Early Access: LOCKED ✅\n\nI\'ll send you a reminder on Thursday evening!' }
          ]
        }
      ]
    },
    7: {
      title: 'Scheme Unlocked for Friday',
      type: 'Scheme Activation',
      screens: [
        {
          label: 'Screen 1 · Scheme Details',
          type: 'Reward Notification',
          desc: 'ZoAi shares the unlocked scheme details and benefits now available to the retailer.',
          messages: [
            { from: 'sender', template: { title: '🎉 Schemes Unlocked!', body: 'Congratulations, Ganesh Traders!\n\nYou\'ve unlocked:\n\n🏆 Double Loyalty Points — Earn 9,200 points on this payment (regular: 4,600)\n🎄 Diwali 2026 Scheme — Early access starting Jul 15\n🎁 Special Discount Voucher — ₹2,000 off on next order > ₹1L\n\nKeep up the timely payments for Platinum Tier!', time: '2:30 PM', btn: '🔓 View All Benefits' } }
          ]
        }
      ]
    },
    8: {
      title: 'PTP Confirmed',
      type: 'Confirmation',
      screens: [
        {
          label: 'Screen 1 · PTP Summary',
          type: 'Commitment',
          desc: 'Summary of all Promise to Pay commitments and benefits confirmed between both parties.',
          messages: [
            { from: 'sender', text: '📋 Promise to Pay Summary\n\nRetailer: Ganesh Traders (JKC-D0432)\nInvoice: INV-2026-88923\nAmount: ₹2,30,496\nConfirmed Date: Friday, 21 Jun 2026\n\nBenefits:\n✅ Double Loyalty Points (2×)\n✅ Diwali Scheme Early Access\n✅ ₹2,000 Discount Voucher\n\nWe\'ll send a reminder on 20 Jun evening.' },
            { from: 'receiver', text: 'Perfect. See you on Friday!' }
          ]
        }
      ]
    },
    9: {
      title: 'Pre-Due Reminder (Thursday)',
      type: 'Reminder',
      screens: [
        {
          label: 'Screen 1 · Payment Eve Reminder',
          type: 'WhatsApp Notification',
          desc: 'ZoAi sends a polite reminder on Thursday evening, one day before the committed payment date.',
          messages: [
            { from: 'sender', text: '⏰ Friendly Reminder!\n\nYour promised payment of ₹2,30,496 is due tomorrow (Friday, 21 Jun).\n\nBank: JK Cement — HDFC\nAccount: 12345678901\nIFSC: HDFC0001234\nUPI: jkcement@hdfcbank\n\nTap to pay now: [🔗 Payment Link]\n\nRetailers who pay before 12 PM get same-day reconciliation! ⚡' },
            { from: 'receiver', text: 'Thanks for the reminder! I\'ll complete the payment by 10 AM tomorrow.' }
          ]
        }
      ]
    },
    10: {
      title: 'Payment Received ✅',
      type: 'Success',
      screens: [
        {
          label: 'Screen 1 · Payment Received',
          type: 'Success Notification',
          desc: 'Payment successfully received. ZoAi sends a confirmation with all relevant details and updated benefits.',
          messages: [
            { from: 'sender', text: '✅ Payment Received Successfully!\n\nInvoice: INV-2026-88923\nAmount: ₹2,30,496\nDate: 21 Jun 2026, 9:45 AM\nUTR: HDFC123456789\nMode: UPI\n\n🏆 Loyalty Points Credited: 9,200 (Double Points!)\n🎉 Diwali Scheme Access: Active\n\nThank you for your timely payment!' },
            { from: 'receiver', text: 'Thank you! The process was smooth. See you next month!' }
          ]
        }
      ]
    },
    11: {
      title: 'Payment Not Received ❌',
      type: 'Escalation',
      screens: [
        {
          label: 'Screen 1 · Missed Payment',
          type: 'Escalation Alert',
          desc: 'If payment is not received by end of day Friday, ZoAi escalates to the collections team for follow-up.',
          messages: [
            { from: 'sender', text: '⚠️ Payment PTP Missed\n\nInvoice INV-2026-88923 of ₹2,30,496 was due today (21 Jun) but not yet received.\n\nGrace period: 3 days\nLate fee: ₹500/day after 24 Jun\nCredit limit impact: Yes\n\nPlease make the payment at the earliest to avoid late fees and credit impact.' },
            { from: 'receiver', text: 'I\'m facing a temporary cash flow issue. Can I get an extension of 5 days?' },
            { from: 'sender', text: 'Your request has been forwarded to the collections team. A team member will call you within 2 hours to discuss an extension plan.' }
          ]
        }
      ]
    }
  },
  dealer_engagement: {
    1: {
      title: 'Campaign & Promotions',
      type: 'Marketing',
      screens: [
        {
          label: 'Screen 1 · Monthly Campaigns',
          type: 'Promotion Broadcast',
          desc: 'JK Cement launches monthly campaigns and promotions for dealers — volume discounts, seasonal offers, and referral bonuses.',
          messages: [
            { from: 'sender', template: { title: '🎯 June Campaign: Monsoon Ready!', body: 'Dear Partner,\n\nMonsoon construction season is here! Stock up now:\n\n🏗️ OPC 53 Grade — Special monsoon pack\n💰 Extra 3% discount on 500+ bags\n🎁 Free JK Cement merchandise on orders >₹1L\n\nOffer valid: 1-30 Jun 2026', time: '9:00 AM', btn: '👀 View Campaign' } },
            { from: 'receiver', text: 'Interested in the monsoon pack. What\'s the pricing per bag?' },
            { from: 'sender', text: 'Monsoon Special Pricing:\n\nOPC 53 Grade: ₹339/bag (regular ₹350)\nPPC: ₹310/bag (regular ₹320)\n\nMinimum order: 100 bags per SKU. Offer valid till 30 Jun.' }
          ]
        }
      ]
    },
    2: {
      title: 'Scheme & Product Queries',
      type: 'Query Resolution',
      screens: [
        {
          label: 'Screen 1 · Product Inquiry',
          type: 'Q&A',
          desc: 'Dealers ask about product specifications, scheme terms, and availability. ZoAi provides instant accurate responses.',
          messages: [
            { from: 'receiver', text: 'What\'s the difference between your PPC and Composite Cement for plastering work?' },
            { from: 'sender', text: 'Great question!\n\n🏗️ PPC (Portland Pozzolana Cement)\n› Best for plastering, masonry, and general construction\n› IS 1489 compliant\n› Cost-effective at ₹320/bag\n› Provides better surface finish\n\n🏗️ Composite Cement\n› Blended with fly ash + slag\n› IS 16415 compliant\n› Superior workability and durability\n› ₹340/bag\n\nFor plastering, both work well. PPC is more economical and gives excellent finish.' },
            { from: 'receiver', text: 'Thanks! I\'ll go with PPC for my current project.' }
          ]
        }
      ]
    },
    3: {
      title: 'Loyalty & Credit Queries',
      type: 'Support',
      screens: [
        {
          label: 'Screen 1 · Loyalty Query',
          type: 'Support Chat',
          desc: 'Dealer inquires about loyalty program status, credit limit, and available schemes. ZoAi provides personalized response.',
          messages: [
            { from: 'receiver', text: 'What\'s my current loyalty tier and how many points do I have?' },
            { from: 'sender', text: '🏆 Your Loyalty Status:\n\nTier: GOLD 🥇\nPoints: 5,200\nNext milestone: 6,000 (PLATINUM 🏆)\n\nPlatinum benefits:\n• 3% flat discount on all orders\n• Priority dispatch\n• Dedicated relationship manager\n• Exclusive scheme access' },
            { from: 'receiver', text: 'Only 800 more points to Platinum! What\'s my current credit limit?' },
            { from: 'sender', text: '💳 Credit Limit: ₹5,00,000\n💰 Used: ₹2,30,496\n📊 Available: ₹2,69,504\n\nYour credit limit was auto-enhanced by 20% last quarter due to excellent payment history.' }
          ]
        }
      ]
    }
  },
  retailer_onboarding: {
    1: {
      title: 'Activation & Registration',
      type: 'Registration',
      screens: [
        {
          label: 'Screen 1 · Registration Initiation',
          type: 'WhatsApp Form',
          desc: 'New retailer receives a registration link via WhatsApp. They fill in business details, upload GST certificate, and verify their store.',
          messages: [
            { from: 'sender', template: { title: '📝 Welcome to JK Cement!', body: 'Dear Partner,\n\nYou\'re invited to join JK Cement\'s digital retailer program!\n\n✅ Self-service ordering\n✅ Real-time inventory\n✅ Loyalty rewards\n✅ Instant payment tracking\n\nTap below to complete your registration.', time: '10:15 AM', btn: '📋 Register Now' } }
          ]
        },
        {
          label: 'Screen 2 · Registration Form',
          type: 'Form',
          desc: 'Retailer fills in their business details — store name, GST number, address, and bank details for payment reconciliation.',
          messages: [
            { from: 'sender', text: 'Please share your details:\n\n🏪 Store Name: Ganesh Traders\n📍 Address: 42, Basni Industrial Area, Jodhpur\n📋 GST: 08ABCDE1234F1Z5\n🏦 Bank: HDFC Bank, Jodhpur\n✅ Account: 12345678901\n\nPlease confirm the above details are correct.' },
            { from: 'receiver', text: 'All details are correct. Please proceed.' },
            { from: 'sender', text: '✅ Registration submitted! Your dealer code: JKC-D0432\n\nWelcome aboard, Ganesh Traders!' }
          ]
        }
      ]
    },
    2: {
      title: 'Welcome & Self Service',
      type: 'Onboarding',
      screens: [
        {
          label: 'Screen 1 · Welcome Message',
          type: 'Interactive Template',
          desc: 'New retailer receives a comprehensive welcome message with onboarding steps and self-service portal access.',
          messages: [
            { from: 'sender', template: { title: '🎉 Welcome to JK Cement!', body: 'Dear Ganesh Traders,\n\nYour dealer account (JKC-D0432) is now active!\n\nNext steps:\n\n1️⃣ Complete your profile\n2️⃣ Browse product catalog\n3️⃣ Place your first order\n4️⃣ Set up UPI for payments\n\nYour relationship manager, Mr. Sharma, will visit your store tomorrow.', time: '11:00 AM', btn: '🚀 Get Started' } }
          ]
        },
        {
          label: 'Screen 2 · Self Service Portal',
          type: 'Menu',
          desc: 'Retailer opens the self-service portal showing key features and quick actions available at their fingertips.',
          messages: [
            { from: 'sender', text: 'Your JK Cement Self Service Portal:\n\n🛒 Place Order\n📦 Track Orders\n💳 Payments & Ledger\n🏆 Loyalty Points\n📄 Invoices & Statements\n🛠️ Support\n\nWhich would you like to explore first?' },
            { from: 'receiver', text: 'Let me check the product catalog.' }
          ]
        }
      ]
    },
    3: {
      title: 'Campaigns & Queries',
      type: 'Marketing',
      screens: [
        {
          label: 'Screen 1 · Campaign Information',
          type: 'Notification',
          desc: 'JK Cement shares ongoing campaigns and offers with the newly onboarded retailer.',
          messages: [
            { from: 'sender', text: '📢 Welcome Offer — New Retailer Special!\n\nAs a new partner, you get:\n🎉 First order: 5% discount on OPC 53 Grade\n🎁 Free JK Cement merchandise kit\n🏆 Double loyalty points for first 3 orders\n\nOffer valid for 30 days from registration.' },
            { from: 'receiver', text: 'That\'s a great welcome offer! Can I place my first order today?' }
          ]
        }
      ]
    },
    4: {
      title: 'Scheme & Product Queries',
      type: 'Product Info',
      screens: [
        {
          label: 'Screen 1 · Product Catalog',
          type: 'Listing',
          desc: 'New retailer explores JK Cement product range with detailed specifications and pricing.',
          messages: [
            { from: 'receiver', text: 'Show me your complete product range with prices.' },
            { from: 'sender', text: '🏗️ JK Cement Product Range\n\n1️⃣ OPC 53 Grade — ₹350/bag\n  › High strength, RCC, bridges, slabs\n  › IS 12269\n\n2️⃣ PPC — ₹320/bag\n  › Plastering, masonry, general construction\n  › IS 1489\n\n3️⃣ PSC — ₹330/bag\n  › Mass concrete, dams, foundations\n  › IS 455\n\n4️⃣ Composite Cement — ₹340/bag\n  › Blended cement, superior workability\n  › IS 16415' },
            { from: 'receiver', text: 'I\'ll start with OPC 53 and PPC. What\'s the minimum order quantity?' },
            { from: 'sender', text: 'Minimum order: 100 bags per SKU. Delivery within 48 hours within 50 km radius of our depot.' }
          ]
        }
      ]
    },
    5: {
      title: 'Self Service Ordering',
      type: 'Ordering',
      screens: [
        {
          label: 'Screen 1 · Place Order',
          type: 'Order Form',
          desc: 'Retailer places their first order through the self-service WhatsApp ordering system.',
          messages: [
            { from: 'receiver', text: 'I want to place my first order. 200 bags OPC 53 Grade.' },
            { from: 'sender', text: '🛒 Order Summary — First Order (New Retailer Discount Applied!)\n\nOPC 53 Grade × 200 bags @ ₹332.50/bag (5% off)\nSubtotal: ₹66,500\nGST (12%): ₹7,980\nTotal: ₹74,480\n\n📍 Deliver to: Ganesh Traders, 42 Basni Area, Jodhpur\n⏱️ Expected: 18 Jun 2026\n\nConfirm order?' },
            { from: 'receiver', text: 'Confirmed! Please process.' },
            { from: 'sender', text: '✅ Order JKC-NEW-0001 created!\n\n🎉 Congratulations on your first order with JK Cement! Your welcome gift kit will be delivered with the order.' }
          ]
        }
      ]
    },
    6: {
      title: 'Catalog Browse & Order',
      type: 'Browse',
      screens: [
        {
          label: 'Screen 1 · Detailed Catalog',
          type: 'Catalog View',
          desc: 'Retailer browses detailed product catalog with images, specifications, and bulk pricing tiers.',
          messages: [
            { from: 'sender', text: '📋 Enhanced Catalog View:\n\n🔹 OPC 53 Grade\n  › 100-299 bags: ₹350/bag\n  › 300-499 bags: ₹340/bag\n  › 500+ bags: ₹335/bag\n\n🔹 PPC\n  › 100-299 bags: ₹320/bag\n  › 300+ bags: ₹310/bag\n\n🔹 Composite Cement\n  › 100-299 bags: ₹340/bag\n  › 300+ bags: ₹330/bag\n\nVolume discounts automatically applied!' },
            { from: 'receiver', text: 'I\'ll add 300 bags OPC 53 and 100 bags PPC.' }
          ]
        }
      ]
    },
    7: {
      title: 'AI Order Capture',
      type: 'AI Ordering',
      screens: [
        {
          label: 'Screen 1 · AI-Assisted Order',
          type: 'ZoAi Chat',
          desc: 'ZoAi assists the retailer in placing an optimized order based on their business profile and past purchases.',
          messages: [
            { from: 'sender', text: '👋 Hi! I\'m ZoAi. I see this is your first week with us! Based on stores similar to yours in Jodhpur, I recommend stocking up for the upcoming construction season.' },
            { from: 'receiver', text: 'Yes, I need advice on how much to order for the season.' },
            { from: 'sender', text: 'Based on market trends in Jodhpur:\n\n📊 Recommended monthly stock:\n› OPC 53 Grade: 400-500 bags\n› PPC: 200-300 bags\n\nWith your current order of 300 OPC + 100 PPC, you\'re well-positioned. Want to add 100 more bags of OPC for the ₹335/bag price?' },
            { from: 'receiver', text: 'Good idea. Add 100 more OPC 53.' }
          ]
        }
      ]
    },
    8: {
      title: 'Distributor Confirmation',
      type: 'Fulfillment',
      screens: [
        {
          label: 'Screen 1 · Distributor Processing',
          type: 'Back Office',
          desc: 'Distributor receives and confirms the order, allocates inventory, and assigns delivery slot.',
          messages: [
            { from: 'sender', text: '📦 Distributor — Gotan Depot\n\nNew order from Ganesh Traders (JKC-D0432)\nOrder: JKC-NEW-0001\n\n📋 300 bags OPC 53 Grade\n📋 100 bags PPC\n\nInventory check: ✅ Sufficient stock\nDelivery slot: 18 Jun, 10:00-12:00\n\nConfirm order?' },
            { from: 'receiver', text: 'Confirmed. Assign vehicle and dispatch.' },
            { from: 'sender', text: '✅ Order confirmed. Truck RJ-27-GB-4455 assigned.\n\nInvoice INV-2026-89001 will be generated.' }
          ]
        }
      ]
    },
    9: {
      title: 'Order to Invoice',
      type: 'Invoicing',
      screens: [
        {
          label: 'Screen 1 · Invoice Generated',
          type: 'Invoice',
          desc: 'System generates GST-compliant e-invoice and shares it with the retailer.',
          messages: [
            { from: 'sender', text: '📄 Invoice INV-2026-89001\n\nOPC 53 × 400 = ₹1,34,000 (avg ₹335/bag)\nPPC × 100 = ₹32,000\nSubtotal: ₹1,66,000\nGST 12%: ₹19,920\nTotal: ₹1,85,920\n\nDue: 18 Jul 2026\n\nFirst order discount: ₹3,500 already applied!' },
            { from: 'receiver', text: 'Great, invoice looks correct!' }
          ]
        }
      ]
    },
    10: {
      title: 'Invoice & Payment',
      type: 'Payment',
      screens: [
        {
          label: 'Screen 1 · Payment Options',
          type: 'Payment Screen',
          desc: 'Retailer presented with multiple payment options — UPI, Net Banking, Credit Card, or Dealer Credit.',
          messages: [
            { from: 'sender', text: '💳 Payment Options for INV-2026-89001\n\nAmount: ₹1,85,920\n\n1️⃣ UPI (Google Pay / PhonePe / Paytm)\n2️⃣ Net Banking\n3️⃣ Credit / Debit Card\n4️⃣ Dealer Credit (30 days)\n\nChoose your payment method.' },
            { from: 'receiver', text: 'I\'ll use Dealer Credit for now. Pay within 30 days.' },
            { from: 'sender', text: '✅ Dealer Credit activated. Due: 18 Jul 2026.\n\nAvailable credit: ₹3,14,080\nTip: Pay within 7 days for 1% discount!' }
          ]
        }
      ]
    },
    11: {
      title: 'Collect Digital Orders',
      type: 'Collection',
      screens: [
        {
          label: 'Screen 1 · Order Collection Summary',
          type: 'Dashboard',
          desc: 'Retailer can view all their digital orders in one place — active, completed, and pending collections.',
          messages: [
            { from: 'sender', text: '📦 Your Orders at a Glance\n\n🟢 JKC-NEW-0001 — Dispatched (ETA 18 Jun)\n⏳ JKC-NEW-0002 — Processing\n✅ JKC-NEW-0003 — Delivered\n\nTotal orders this month: 3\nTotal value: ₹4,82,000\nAll orders on track!' }
          ]
        }
      ]
    },
    12: {
      title: 'Collect Payments',
      type: 'Settlement',
      screens: [
        {
          label: 'Screen 1 · Payment Settlement',
          type: 'Settlement',
          desc: 'Final settlement summary showing all payments collected, pending, and reconciled for the month.',
          messages: [
            { from: 'sender', text: '📊 Monthly Settlement — June 2026\n\nTotal Invoiced: ₹4,82,000\nTotal Collected: ₹2,96,080\nPending: ₹1,85,920 (Due 18 Jul)\n\nLoyalty Points Earned: 1,200\nCurrent Tier: Silver 🥈\nProgress to Gold: 300 more points' },
            { from: 'receiver', text: 'Great first month! Looking forward to growing with JK Cement.' }
          ]
        }
      ]
    }
  },
  retailer_loyalty: {
    1: {
      title: 'Loyalty Program Overview',
      type: 'Program Info',
      screens: [
        {
          label: 'Screen 1 · Program Introduction',
          type: 'Overview',
          desc: 'JK Cement loyalty program overview — tier structure, earning rates, and redemption options for dealers.',
          messages: [
            { from: 'sender', template: { title: '🏆 JK Cement Loyalty Program', body: 'Earn points on every purchase and unlock exclusive benefits!\n\n🥈 Silver: 0-3,000 pts\n  › Base earning: 1 pt per ₹100\n\n🥇 Gold: 3,001-6,000 pts\n  › 1.5 pts per ₹100 + quarterly bonus\n\n🏆 Platinum: 6,001+ pts\n  › 2 pts per ₹100 + 3% discount + priority support\n\nYou\'re currently: SILVER with 1,200 points', time: '9:00 AM', btn: '🔍 View My Progress' } }
          ]
        }
      ]
    },
    2: {
      title: 'Points & Rewards',
      type: 'Rewards',
      screens: [
        {
          label: 'Screen 1 · Earned Points',
          type: 'Statement',
          desc: 'Detailed points earning and redemption statement showing how points are accumulated and used.',
          messages: [
            { from: 'receiver', text: 'How many points have I earned this month?' },
            { from: 'sender', text: '📊 June Points Statement\n\nOpening Balance: 800 pts\n\n02 Jun — Purchase ₹2,10,000: +2,100 pts\n17 Jun — Purchase ₹1,85,920: +1,859 pts\n21 Jun — Early Payment Bonus: +500 pts\n🎉 New Retailer Bonus: +500 pts\n\nTotal Earned: 4,959 pts\nRedeemed: 0 pts\nClosing Balance: 4,959 pts\n\nCongratulations! You\'ve reached GOLD tier! 🥇' },
            { from: 'receiver', text: 'Great, I\'m Gold now! What rewards can I redeem?' },
            { from: 'sender', text: 'Available Rewards for Gold Tier:\n\n1️⃣ 1,000 pts → ₹500 discount on next order\n2️⃣ 2,500 pts → Free delivery (up to 50 km)\n3️⃣ 5,000 pts → ₹3,000 merchandise voucher\n4️⃣ 10,000 pts → Smartphone / LED TV\n\nTap to explore!' }
          ]
        }
      ]
    },
    3: {
      title: 'Tier Progress',
      type: 'Progress',
      screens: [
        {
          label: 'Screen 1 · Tier Upgrade Path',
          type: 'Progress Bar',
          desc: 'Visual progress toward next tier with clear milestones and benefits at each level.',
          messages: [
            { from: 'sender', text: '🏆 Your Tier Progress\n\n🥇 GOLD — Current (4,959 pts)\n━━━━━━━━━━━━━━━━━━━ 83%\n▶ 1,041 pts to PLATINUM\n\nBenefits unlocked at Platinum:\n✅ 3% flat discount (vs current 1.5%)\n✅ Dedicated RM\n✅ Priority dispatch within 24 hrs\n✅ Exclusive scheme access\n✅ Annual dealer summit invitation\n\nAt current order rate, you\'ll reach Platinum in ~2 months!' },
            { from: 'receiver', text: 'I\'ll increase my order volume to reach Platinum faster.' }
          ]
        }
      ]
    },
    4: {
      title: 'Exclusive Offers',
      type: 'Offers',
      screens: [
        {
          label: 'Screen 1 · Gold Tier Offers',
          type: 'Special Deals',
          desc: 'Exclusive offers available only to Gold and Platinum tier members — limited period schemes.',
          messages: [
            { from: 'sender', template: { title: '🎁 Gold Tier Exclusive!', body: 'Dear Ganesh Traders,\n\nAs a Gold member, you get:\n\n1️⃣ Monsoon Special: Extra 2% off on 500+ bags\n2️⃣ Referral Reward: 500 pts per new referral\n3️⃣ Birthday Month Bonus: 1,000 bonus points in July\n4️⃣ Free JK Cement merchandise on orders >₹2L\n\nValid till 30 Jun 2026.', time: '10:00 AM', btn: '⚡ Claim Offer' } }
          ]
        }
      ]
    },
    5: {
      title: 'Redemption History',
      type: 'History',
      screens: [
        {
          label: 'Screen 1 · Redemption Log',
          type: 'Statement',
          desc: 'Complete history of points earned, redeemed, and balance over the lifetime of the loyalty program membership.',
          messages: [
            { from: 'receiver', text: 'Show me my complete redemption history.' },
            { from: 'sender', text: '📋 Complete History\n\nDate | Activity | Points\n━━━━━━━━━━━━━━━━━━━━━━━━━\n10 May | Purchase ₹1.5L | +1,500\n15 May | Purchase ₹2.0L | +2,000\n20 May | Welcome Bonus | +500\n22 May | Redeemed: ₹500 off | −1,000\n02 Jun | Purchase ₹2.1L | +2,100\n17 Jun | Purchase ₹1.86L | +1,859\n21 Jun | Early Payment Bonus | +500\n\nTotal Earned: 8,459 pts\nTotal Redeemed: 1,000 pts\nCurrent Balance: 7,459 pts' },
            { from: 'receiver', text: 'I have enough for the ₹3,000 merchandise voucher! How do I redeem?' },
            { from: 'sender', text: 'To redeem 5,000 pts for ₹3,000 JK Cement merchandise voucher, reply REDEEM. The voucher will be shared via WhatsApp within 24 hours.' }
          ]
        }
      ]
    },
    6: {
      title: 'Program Summary',
      type: 'Summary',
      screens: [
        {
          label: 'Screen 1 · Program Summary Card',
          type: 'Summary',
          desc: 'Comprehensive summary of the loyalty program showing current status, benefits, and next milestones.',
          messages: [
            { from: 'sender', template: { title: '🏆 Your Loyalty Summary', body: 'Ganesh Traders (JKC-D0432)\n\nTier: GOLD 🥇\nPoints Balance: 7,459 pts\n\nThis Month:\n📈 Orders: ₹3,95,920\n⭐ Points Earned: 4,459 pts\n\nNext Milestone: PLATINUM\n▶ 0% Complete (frozen — already Gold)\n\nActive Benefits:\n✅ 1.5× points on all orders\n✅ Quarterly bonus: 500 pts\n✅ Exclusive Gold offers\n\nMember since: May 2026', time: '6:00 PM', btn: '📥 Download Card' } }
          ]
        }
      ]
    }
  }
};

// Helper: extract logo from existing brand asset
function getLogoBase64(brand) {
  // Try brand-specific SVG logo first, then shared logo
  const paths = [
    path.join(__dirname, '..', 'assets', 'brands', brand, 'logo.svg'),
    path.join(__dirname, '..', 'assets', 'brands', 'logo.svg'),
    path.join(__dirname, '..', 'public', 'assets', 'brands', 'logo.webp')
  ];
  for (const p of paths) {
    try {
      const data = fs.readFileSync(p);
      const ext = p.endsWith('.svg') ? 'svg+xml' : 'webp';
      return 'data:image/' + ext + ';base64,' + data.toString('base64');
    } catch {}
  }
  // Fallback: JK Cement branded SVG inline
  return 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="40" fill="#003D7A"/><rect x="25" y="50" width="70" height="100" rx="6" fill="#C1A56C" opacity=".9"/><rect x="105" y="50" width="70" height="100" rx="6" fill="#C1A56C" opacity=".6"/><rect x="65" y="30" width="70" height="100" rx="6" fill="#D4AF37" opacity=".8"/><text x="100" y="160" font-family="Arial" font-size="22" font-weight="bold" fill="#C1A56C" text-anchor="middle" letter-spacing="2">JK CEMENT</text></svg>').toString('base64');
}

const CSS = `:root{--brand:#003D7A;--brand-dark:#002856;--accent:#C1A56C;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f2f5;display:flex;min-height:100vh;}
.sidebar{width:260px;background:#fff;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;height:100vh;position:sticky;top:0;flex-shrink:0;z-index:10;}
.sb-head{padding:18px 16px 14px;border-bottom:1px solid #f0f0f0;}
.brand-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.brand-logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--brand));display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0;}
.brand-logo img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;}
.brand-name{font-size:15px;font-weight:700;color:#111;line-height:1.2;}
.brand-industry{font-size:11px;color:#888;}
.journey-lbl{font-size:11px;font-weight:700;color:var(--brand);text-transform:uppercase;letter-spacing:.5px;}
.step-list{flex:1;overflow-y:auto;padding:8px 0;}
.step-item{display:flex;align-items:flex-start;gap:9px;padding:9px 14px;cursor:pointer;border-left:3px solid transparent;transition:all .15s;}
.step-item:hover{background:#f0f4ff;}
.step-item.active{background:#e8f0fe;border-left-color:var(--brand);}
.step-num{width:20px;height:20px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#666;flex-shrink:0;margin-top:2px;}
.step-item.active .step-num{background:var(--brand);color:#fff;}
.step-lbl{font-size:12px;font-weight:600;color:#333;line-height:1.35;}
.step-item.active .step-lbl{color:var(--brand);}
.step-meta{font-size:10px;color:#aaa;margin-top:1px;}
.sb-foot{padding:10px 14px;border-top:1px solid #f0f0f0;font-size:10px;color:#aaa;text-align:center;}
.main{flex:1;display:flex;flex-direction:column;min-height:100vh;overflow:hidden;}
.main-head{background:#fff;border-bottom:1px solid #e8e8e8;padding:13px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.step-title{font-size:16px;font-weight:700;color:#111;}
.step-counter{font-size:12px;color:#888;background:#f5f5f5;border-radius:20px;padding:4px 12px;}
.step-desc-bar{background:#fff;border-bottom:1px solid #f0f0f0;padding:7px 28px;display:flex;align-items:center;gap:8px;font-size:12px;color:#555;flex-shrink:0;flex-wrap:wrap;}
.tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;}
.tag-ord{background:#e8f5e9;color:#1B5E20;}
.tag-ai{background:#ede7f6;color:#4527A0;}
.tag-pay{background:#e0f2f1;color:#00695C;}
.tag-act{background:#fff3e0;color:#E65100;}
.tag-sch{background:#f9fbe7;color:#558B2F;}
.tag-web{background:#f3e5f5;color:#6A1B9A;}
.screens-area{flex:1;overflow-y:auto;overflow-x:auto;padding:24px 16px;background:#f0f2f5;}
.step-section{display:none;width:100%;justify-content:center;gap:20px;flex-wrap:wrap;align-items:flex-start;}
.step-section.active{display:flex;flex-wrap:nowrap;justify-content:center;}
#step-2.active,.step3-section.active{flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:20px;}
.screen-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
.screen-lbl{font-size:10.5px;color:#888;text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
.screen-type-lbl{font-size:10px;color:#aaa;margin-top:1px;}
.screen-desc{width:305px;border-radius:12px;padding:10px 14px 11px;font-size:13px;line-height:1.5;color:#2a2a2a;}
.screen-desc strong{font-size:13.5px;font-weight:700;color:#111;display:block;margin-bottom:3px;}
.phone-frame{width:305px;border-radius:38px;border:8px solid #1a1a1a;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;display:flex;flex-direction:column;background:#ECE5DD;height:610px;position:relative;flex-shrink:0;}
.status-bar{background:#075E54;padding:8px 14px 5px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.status-time{font-size:13px;font-weight:600;color:#fff;}
.status-icons{display:flex;align-items:center;gap:5px;}
.wa-topbar{background:#075E54;padding:6px 10px 8px;display:flex;align-items:center;gap:8px;flex-shrink:0;border-bottom:1px solid rgba(0,0,0,.1);}
.wa-back{display:flex;align-items:center;padding-right:2px;}
.wa-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--brand));flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;}
.wa-contact{flex:1;min-width:0;}
.wa-contact-name{font-size:14px;font-weight:600;color:#fff;}
.wa-contact-status{font-size:10px;color:rgba(255,255,255,.7);}
.wa-actions{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.chat-area{flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:3px;background:#ECE5DD;}
.date-pill{background:rgba(225,245,254,.92);align-self:center;padding:4px 10px;border-radius:6px;font-size:11px;color:#54656f;font-weight:600;margin:4px 0;box-shadow:0 1px 1px rgba(0,0,0,.05);}
.msg-sender-wrap{display:flex;justify-content:flex-end;margin:1px 0;}
.msg-sender{max-width:88%;background:#D9FDD3;border-radius:8px 0 8px 8px;padding:5px 8px 4px;position:relative;box-shadow:0 1px 1px rgba(0,0,0,.08);word-wrap:break-word;}
.msg-sender .msg-body{font-size:13.2px;line-height:1.45;color:#111;}
.msg-sender .msg-time{font-size:10px;color:#667781;float:right;margin-top:2px;margin-left:6px;}
.msg-receiver-wrap{display:flex;justify-content:flex-start;margin:1px 0;}
.msg-receiver{max-width:88%;background:#fff;border-radius:0 8px 8px 8px;padding:5px 8px 4px;position:relative;box-shadow:0 1px 1px rgba(0,0,0,.08);word-wrap:break-word;}
.msg-receiver .msg-body{font-size:13.2px;line-height:1.45;color:#111;}
.msg-receiver .msg-time{font-size:10px;color:#667781;float:right;margin-top:2px;margin-left:6px;}
.wa-tmpl{border-radius:8px;overflow:hidden;background:#fff;width:100%;box-shadow:0 1px 2px rgba(0,0,0,.1);}
.wa-tmpl-body{padding:0 11px 6px;font-size:13px;line-height:1.5;color:#333;}
.wa-tmpl-time{padding:0 11px 6px;font-size:10.5px;color:#999;}
.wa-tmpl-btns{padding:0;border-top:1px solid #f0f0f0;}
.wa-cta-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;font-size:13px;font-weight:600;color:#00A884;cursor:pointer;border-top:1px solid #f0f0f0;transition:background .15s;}
.wa-cta-btn:hover{background:#f0faf8;}
.input-bar{background:#f0f2f5;padding:6px 10px;display:flex;align-items:center;gap:8px;flex-shrink:0;border-top:1px solid #e0e0e0;}
.input-field{flex:1;background:#fff;border-radius:20px;padding:7px 12px;font-size:13px;color:#667781;}
.nav-bar{background:#fff;border-top:1px solid #e8e8e8;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.nav-btn{padding:8px 18px;border-radius:8px;border:1.5px solid #e0e0e0;background:#fff;font-size:13px;font-weight:600;color:#333;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;}
.nav-btn:hover:not(:disabled){border-color:var(--brand);color:var(--brand);background:#f0f4ff;}
.nav-btn:disabled{opacity:.3;cursor:not-allowed;}
.nav-btn.primary{background:var(--brand);border-color:var(--brand);color:#fff;}
.nav-btn.primary:hover:not(:disabled){background:var(--brand-dark);border-color:var(--brand-dark);}
.mob-overlay{display:none;}
@media(max-width:768px){
  .sidebar{position:fixed;left:-280px;transition:left .3s;z-index:100;}
  .sidebar.open{left:0;}
  .mob-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;}
  .mob-overlay.show{display:block;}
  .step-section.active{flex-direction:column;align-items:center;}
  .screen-wrap{width:100%;}
  .phone-frame{margin:0 auto;}
}`;

const NAV_JS = `
let currentStep = 1;
const totalSteps = STEPS_COUNT_PLACEHOLDER;
function showDesktopStep(n) {
  if (n < 1 || n > totalSteps) return;
  document.querySelectorAll('.step-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));
  const section = document.getElementById('step-' + n);
  if (section) section.classList.add('active');
  const items = document.querySelectorAll('.step-item');
  if (items[n - 1]) items[n - 1].classList.add('active');
  const title = document.querySelector('#step-title-text');
  const titles = STEPS_TITLES_PLACEHOLDER;
  if (title && titles[n - 1]) title.textContent = titles[n - 1];
  const counter = document.querySelector('.step-counter');
  if (counter) counter.textContent = 'Step ' + n + ' of ' + totalSteps;
  currentStep = n;
  updateNavButtons();
}
function updateNavButtons() {
  const prev = document.getElementById('nav-prev');
  const next = document.getElementById('nav-next');
  if (prev) prev.disabled = currentStep <= 1;
  if (next) next.disabled = currentStep >= totalSteps;
}
function nextStep() { if (currentStep < totalSteps) showDesktopStep(currentStep + 1); }
function prevStep() { if (currentStep > 1) showDesktopStep(currentStep - 1); }
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight') nextStep();
  if (e.key === 'ArrowLeft') prevStep();
});
function openSidebar() { document.querySelector('.sidebar').classList.add('open'); document.getElementById('mob-overlay').classList.add('show'); }
function closeSidebar() { document.querySelector('.sidebar').classList.remove('open'); document.getElementById('mob-overlay').classList.remove('show'); }
`;

function renderMessages(messages) {
  return messages.map(m => {
    if (m.template) {
      const btns = m.template.btn 
        ? '<div class="wa-tmpl-btns"><div class="wa-cta-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" stroke="#00A884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 21l-4-4 4-4" stroke="#00A884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 17h10a2 2 0 002-2v-4" stroke="#00A884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' + m.template.btn + '</div></div>'
        : '';
      return '<div class="msg-receiver-wrap"><div class="wa-tmpl"><div style="padding:8px 11px 2px;font-size:13.5px;font-weight:700;color:var(--brand);line-height:1.4;">' + m.template.title + '</div><div class="wa-tmpl-body" style="padding-top:4px;">' + m.template.body + '</div><div class="wa-tmpl-time">' + (m.template.time || '') + '</div>' + btns + '</div></div>';
    }
    if (m.from === 'system') {
      return '<div class="date-pill">' + m.text + '</div>';
    }
    if (m.from === 'sender') {
      return '<div class="msg-sender-wrap"><div class="msg-sender"><div class="msg-body">' + m.text.replace(/\n/g, '<br>') + '</div></div></div>';
    }
    return '<div class="msg-receiver-wrap"><div class="msg-receiver"><div class="msg-body">' + m.text.replace(/\n/g, '<br>') + '</div></div></div>';
  }).join('\n');
}

function generateStepHTML(stepNum, stepData, brandConfig) {
  const screens = stepData.screens.map(screen => {
    const msgHtml = renderMessages(screen.messages);
    return `
      <div class="screen-wrap">
        <div class="screen-lbl">${screen.label}</div>
        <div class="screen-type-lbl">${screen.type}</div>
        <div class="phone-frame">
          <div class="status-bar">
            <span class="status-time">9:41</span>
            <div class="status-icons">
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none"><rect x="0" y="7" width="3" height="4" rx=".5" fill="#fff"/><rect x="4" y="4.5" width="3" height="5.5" rx=".5" fill="#fff"/><rect x="8" y="2" width="3" height="9" rx=".5" fill="#fff"/></svg>
            </div>
          </div>
          <div class="wa-topbar">
            <div class="wa-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <div class="wa-avatar"><img src="LOGO_BASE64_PLACEHOLDER" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" /></div>
            <div class="wa-contact">
              <div class="wa-contact-name">${brandConfig.name}</div>
              <div class="wa-contact-status">Business Account</div>
            </div>
            <div class="wa-actions">
              <svg width="18" height="13" viewBox="0 0 24 17" fill="none"><rect x="1" y="1" width="15" height="15" rx="2" stroke="#fff" stroke-width="2"/><path d="M16 6l7-4v13l-7-4V6z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1" fill="#fff"/><circle cx="12" cy="12" r="1" fill="#fff"/><circle cx="12" cy="19" r="1" fill="#fff"/></svg>
            </div>
          </div>
          <div class="chat-area">${msgHtml}</div>
          <div class="input-bar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#54656f" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="#54656f" stroke-width="1.8" stroke-linecap="round"/></svg>
            <div class="input-field">Type a message</div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="#54656f" stroke-width="1.8"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="#54656f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
        <div class="screen-desc" style="background:#e3f2fd;">
          <strong>${screen.label.replace('Screen', 'Context')}</strong>
          ${screen.desc}
        </div>
      </div>`;
  }).join('\n');

  return `<div id="step-${stepNum}" class="step-section${stepNum === 1 ? ' active' : ''}">${screens}</div>`;
}

function generateJourneyHTML(brandKey, journeyType, journeyData, conversations) {
  const brand = BRANDS[brandKey];
  const steps = Object.keys(conversations).sort((a, b) => Number(a) - Number(b));
  const stepTitles = steps.map(s => conversations[s].title);
  const tagColors = { 'Order Placement': 'tag-ord', 'Product Selection': 'tag-web', 'AI-Assisted Ordering': 'tag-ai', 'Payment': 'tag-pay', 'Notification': 'tag-act', 'Marketing': 'tag-ord', 'Onboarding': 'tag-ord', 'Invoicing': 'tag-web', 'Support': 'tag-act', 'Fulfillment': 'tag-ord', 'Overview': 'tag-sch', 'Rewards': 'tag-sch', 'Progress': 'tag-sch', 'Offers': 'tag-sch', 'History': 'tag-sch', 'Summary': 'tag-sch' };
  const tagClass = tagColors[conversations['1']?.type] || 'tag-ord';
  
  const sidebarSteps = steps.map(s => {
    const d = conversations[s];
    return `<div class="step-item${s === '1' ? ' active' : ''}" onclick="showDesktopStep(${s})">
      <div class="step-num">${s}</div>
      <div>
        <div class="step-lbl">${d.title}</div>
        <div class="step-meta">${d.type}</div>
      </div>
    </div>`;
  }).join('\n');

  const stepSections = steps.map(s => {
    return generateStepHTML(Number(s), conversations[s], brand);
  }).join('\n');

  const stepTitlesJSON = JSON.stringify(stepTitles);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brand.name} — ${journeyData.title} | ZoTok Journey</title>
<style>${CSS}</style>
</head>
<body>

<!-- Flyout overlay -->
<div class="mob-overlay" id="mob-overlay" onclick="closeSidebar()"></div>

<!-- Sidebar -->
<nav class="sidebar">
  <button class="mob-sb-close" onclick="closeSidebar()" style="position:absolute;top:8px;right:8px;background:none;border:none;font-size:18px;color:#999;cursor:pointer;">&#10005;</button>
  <div class="sb-head" style="padding-right:36px;">
    <div class="brand-row">
      <div class="brand-logo" style="background:none;overflow:hidden;padding:0;"><img src="LOGO_BASE64_PLACEHOLDER" alt="${brand.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" /></div>
      <div>
        <div class="brand-name">${brand.name}</div>
        <div class="brand-industry">${brand.industry}</div>
      </div>
    </div>
    <div class="journey-lbl">${journeyData.title}</div>
  </div>
  <div class="step-list">
    ${sidebarSteps}
  </div>
  <div class="sb-foot">ZoTok Journey Demo</div>
</nav>

<!-- Main -->
<div class="main">
  <div class="main-head">
    <button class="mob-sb-open" onclick="openSidebar()" style="display:none;background:none;border:none;font-size:20px;cursor:pointer;padding:2px 6px;">&#9776;</button>
    <div class="step-title" id="step-title-text">${stepTitles[0]}</div>
    <div class="step-counter">Step 1 of ${steps.length}</div>
  </div>
  <div class="step-desc-bar">
    <span class="tag ${tagClass}">${journeyData.title}</span>
    <span>${steps.length} steps · WhatsApp Integration</span>
  </div>
  <div class="screens-area">
    ${stepSections}
  </div>
  <div class="nav-bar">
    <button class="nav-btn" id="nav-prev" onclick="prevStep()" disabled>&#8592; Previous</button>
    <button class="nav-btn primary" id="nav-next" onclick="nextStep()">Next &#8594;</button>
  </div>
</div>

<script>
const STEPS_COUNT = ${steps.length};
const STEPS_TITLES = ${stepTitlesJSON};
${NAV_JS.replace('STEPS_COUNT_PLACEHOLDER', String(steps.length)).replace('STEPS_TITLES_PLACEHOLDER', stepTitlesJSON)}
// Re-trigger on load
document.addEventListener('DOMContentLoaded', function() {
  showDesktopStep(1);
  // Handle mobile toggle
  var mobBtn = document.querySelector('.mob-sb-open');
  if (mobBtn && window.innerWidth <= 768) mobBtn.style.display = 'block';
});
</script>
</body>
</html>`;

  // Replace logo placeholder
  const logoB64 = getLogoBase64(brandKey);
  html = html.replace(/LOGO_BASE64_PLACEHOLDER/g, logoB64);

  return html;
}

// Main
const args = process.argv.slice(2);
const targetJourney = args[0] || 'all';

const journeys = [
  { key: 'order_to_cash', brand: 'jk_cement', title: 'Order to Cash', convKey: 'order_to_cash' },
  { key: 'field_ops_expense', brand: 'jk_cement', title: 'Field Ops & Expense Management', convKey: 'field_ops_expense' },
  { key: 'automated_collections', brand: 'jk_cement', title: 'Automated Payment Collection', convKey: 'automated_collections' },
  { key: 'dealer_engagement', brand: 'jk_cement', title: 'Dealer Engagement', convKey: 'dealer_engagement' },
  { key: 'retailer_onboarding', brand: 'jk_cement', title: 'Retailer Onboarding to Cash', convKey: 'retailer_onboarding' },
  { key: 'retailer_loyalty', brand: 'jk_cement', title: 'Turnover-Based Loyalty Scheme', convKey: 'retailer_loyalty' }
];

const outputDir = path.join(__dirname, '..', 'dist', 'jk_cement', 'premium');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

journeys.forEach(j => {
  if (targetJourney !== 'all' && j.key !== targetJourney) return;
  
  const conversations = CONVERSATIONS[j.convKey];
  if (!conversations) {
    console.log('SKIP ' + j.key + ': no conversation data');
    return;
  }

  const journeyData = { title: j.title };
  const html = generateJourneyHTML(j.brand, j.key, journeyData, conversations);
  
  const outPath = path.join(outputDir, 'journey_' + j.key + '.html');
  fs.writeFileSync(outPath, html, 'utf8');
  
  const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log('✅ ' + outPath + ' (' + sizeKB + ' KB, ' + Object.keys(conversations).length + ' steps)');
});

console.log('\nDone! Premium demos generated in dist/jk_cement/premium/');
