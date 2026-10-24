#!/usr/bin/env node
/**
 * Milkey — Server-Clone Mock Data Generator
 * Fills every collection with min 10 realistic documents (ponytail, no duplication, server/ untouched)
 * Usage:
 *   node scripts/mockData.js              -> insert missing (idempotent, keeps existing)
 *   node scripts/mockData.js --clean      -> delete mock data first, then re-seed 10 each
 *   node scripts/mockData.js --count=20   -> 20 per collection
 *   node scripts/mockData.js --status     -> only show counts, no write
 *   npm run mock | npm run mock:clean | npm run mock:status
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// ---- load all models (ensures mongoose knows them) ----
const User = require('../models/User');
const Admin = require('../models/Admin');
const Farmer = require('../models/Farmer');
const PurchaseFarmer = require('../models/PurchaseFarmer');
const Member = require('../models/Member');
const MilkCollection = require('../models/MilkCollection');
const Payment = require('../models/Payment');
const Advance = require('../models/Advance');
const SellingEntry = require('../models/SellingEntry');
const MemberPayment = require('../models/MemberPayment');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Faq = require('../models/Faq');
const VideoTutorial = require('../models/VideoTutorial');
const SocialLink = require('../models/SocialLink');
const Subscription = require('../models/Subscription');
const UserSubscription = require('../models/UserSubscription');
const RateChart = require('../models/RateChart');
const RateChartSettings = require('../models/RateChartSettings');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
const CustomForm = require('../models/CustomForm');
const Device = require('../models/Device');
const Withdrawal = require('../models/Withdrawal');
const Referral = require('../models/Referral');
const ReferralConfig = require('../models/ReferralConfig');
const AppVersion = require('../models/AppVersion');
const WhatsappSettings = require('../models/WhatsappSettings');
const PaymentSettings = require('../models/PaymentSettings');
const PrintSettings = require('../models/PrintSettings');
const WhatsappMessageLog = require('../models/WhatsappMessageLog');

// ---- CLI args ----
const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const STATUS_ONLY = args.includes('--status');
let COUNT = 10;
for (const a of args) if (a.startsWith('--count=')) COUNT = Math.max(1, parseInt(a.split('=')[1]) || 10);

// ---- helpers ----
const firstNames = ['Ramesh','Suresh','Mahesh','Dinesh','Rajesh','Mukesh','Naresh','Kamlesh','Hitesh','Jitesh','Amit','Sunil','Anil','Vijay','Ravi','Deepak','Karan','Arjun','Prakash','Santosh'];
const lastNames = ['Kumar','Patel','Singh','Sharma','Yadav','Verma','Joshi','Prajapati','Desai','Modi','Mehta','Rao','Reddy','Gupta','Shah','Khan','Ansari','Thakur','Chauhan','Mishra'];
const villages = ['Kheda','Borsad','Petlad','Nadiad','Dakor','Kapadvanj','Thasra','Mahudha','Balasinor','Lunawada','Anand','Umreth','Sarsa','Vasad','Karamsad'];
const products = [
  { name:'Fresh Milk', price:60, unit:'liter', icon:'🥛', desc:'Fresh cow milk', stock:100 },
  { name:'Buffalo Milk', price:70, unit:'liter', icon:'🐃', desc:'Fresh buffalo milk', stock:80 },
  { name:'Paneer', price:350, unit:'kg', icon:'🧀', desc:'Fresh paneer', stock:20 },
  { name:'Ghee', price:600, unit:'kg', icon:'🫕', desc:'Pure desi ghee', stock:15 },
  { name:'Curd', price:50, unit:'kg', icon:'🥣', desc:'Fresh curd', stock:50 },
  { name:'Buttermilk', price:30, unit:'liter', icon:'🥤', desc:'Fresh buttermilk', stock:40 },
  { name:'Cream', price:250, unit:'kg', icon:'🍦', desc:'Fresh cream', stock:10 },
  { name:'Khoya', price:400, unit:'kg', icon:'🍮', desc:'Fresh khoya', stock:8 },
  { name:'Lassi', price:40, unit:'liter', icon:'🥛', desc:'Sweet lassi', stock:30 },
  { name:'Milk Powder', price:500, unit:'kg', icon:'🥛', desc:'Skimmed milk powder', stock:12 },
];
const banners = [
  { title:'Summer Offer', image:'https://res.cloudinary.com/demo/image/upload/v1/milkey/banner1.jpg', badge:'20% OFF' },
  { title:'Festival Special', image:'https://res.cloudinary.com/demo/image/upload/v1/milkey/banner2.jpg', badge:'New' },
  { title:'Farmer Support', image:'https://res.cloudinary.com/demo/image/upload/v1/milkey/banner3.jpg', badge:'Trending' },
];
const faqs = [
  { q:'How to record milk collection?', a:'Go to Purchase tab, select farmer code, enter quantity, fat, SNF and save.', c:'general' },
  { q:'How to make payment to farmer?', a:'Open Register → Payments, select farmer, enter period and amount.', c:'payments' },
  { q:'Can I use offline?', a:'Yes, entries are queued and synced when online.', c:'general' },
  { q:'How to add new member for selling?', a:'Selling → Customer → Add, fill name mobile rate.', c:'selling' },
  { q:'What is Rate Chart?', a:'Rate Chart calculates price based on Fat & SNF. Enable per farmer.', c:'purchase' },
];
const categories = [
  { name:'Milk', slug:'milk', icon:'🥛', color:'#22C55E' },
  { name:'Curd & Yogurt', slug:'curd-yogurt', icon:'🥣', color:'#3B82F6' },
  { name:'Ghee & Butter', slug:'ghee-butter', icon:'🧈', color:'#F59E0B' },
  { name:'Paneer', slug:'paneer', icon:'🧀', color:'#EC4899' },
  { name:'Sweets', slug:'sweets', icon:'🍮', color:'#8B5CF6' },
];

const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const rand = (a,b) => Math.round((Math.random()*(b-a)+a)*10)/10;
const randint = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const phone = (base=9000000000) => String(base + randint(1000000, 9999999));
const dateAgo = (days) => { const d=new Date(); d.setDate(d.getDate()-randint(0,days)); d.setHours(randint(6,20), randint(0,59),0,0); return d; };
const fullName = () => `${pick(firstNames)} ${pick(lastNames)}`;
const villageAddr = () => `Village ${pick(villages)}, Dist. ${pick(['Anand','Kheda','Mahisagar','Nadiad'])}`;

// ---- ensure owner/admin exists (reused as FK for all owner-scoped collections) ----
async function ensureOwner() {
  // Primary mock owner + your real test phones — sabke liye data banega
  const testPhones = ['9000000011', '9174354715', '9876543210'];
  const owners = [];
  let primary = null;
  for (const phoneOwner of testPhones) {
    let user = await User.findOne({ phone: phoneOwner });
    if (!user) {
      user = await User.create({
        name: phoneOwner === '9174354715' ? 'Test User (Your Phone)' : phoneOwner === '9876543210' ? 'Demo User' : 'Milkey Mock Owner',
        phone: phoneOwner,
        email: phoneOwner === '9000000011' ? 'mock.owner@milkey.test' : `test.${phoneOwner}@milkey.test`,
        password: '$2a$10$mockhashmockhashmockhashmockha',
        role: 'owner',
        referralCode: `MOCK${phoneOwner.slice(-4)}`,
        isVerified: true,
        address: 'Mock Dairy, Anand',
      });
      console.log(`👤 Created mock owner ${user.phone} (${user._id})`);
    } else console.log(`👤 Reusing mock owner ${user.phone} (${user._id})`);
    owners.push(user);
    if (phoneOwner === '9000000011') primary = user;
  }
  let user = primary;

  // create 9 more mock users for referral/member contexts
  const extraUsers=[];
  for(let i=1;i<COUNT;i++){
    const ph = phone(9000000020+i);
    let u = await User.findOne({ phone: ph });
    if(!u){
      try{
        u = await User.create({ name: fullName(), phone: ph, email: `mock.user${i}@milkey.test`, role: pick(['owner','staff','farmer']), referralCode: `MOCK${1000+i}`, isVerified: Math.random()>0.3 });
      }catch(e){ u = await User.findOne({ phone: ph }); }
    }
    if(u) extraUsers.push(u);
  }
  // Also create extra owners list for seeding
  const allOwnersForSeed = owners; // will seed for each test phone

  let admin = await Admin.findOne({ email: 'admin@milkey.test' });
  if (!admin) {
    admin = await Admin.create({ name:'Mock Admin', email:'admin@milkey.test', password:'$2a$10$mockhashmockhashmockhashmockha', role:'superadmin', isActive:true });
    console.log(`👑 Created mock admin ${admin.email}`);
  } else console.log(`👑 Reusing mock admin ${admin.email}`);

  return { owner: user, extraUsers, admin, allOwnersForSeed };
}

// ---- per-model seed helpers (idempotent: only fill up to COUNT if fewer exist) ----
async function ensureCount(Model, filter, makeFn, label) {
  const existing = await Model.countDocuments(filter);
  const need = Math.max(0, COUNT - existing);
  if (need===0) { console.log(`✓ ${label}: ${existing} already (need ${COUNT}) — skip`); return { created:0, total:existing }; }
  const docs = [];
  for(let i=0;i<need;i++) docs.push(makeFn(i, existing+i));
  try{
    const inserted = await Model.insertMany(docs, { ordered:false });
    console.log(`➕ ${label}: +${inserted.length} (was ${existing}, now ${existing+inserted.length})`);
    return { created: inserted.length, total: existing+inserted.length };
  }catch(e){
    // ignore duplicates, count what succeeded
    const total = await Model.countDocuments(filter);
    console.log(`⚠️ ${label}: partial — ${e.message} (now ${total})`);
    return { created: total-existing, total };
  }
}

async function seedAll({ owner, extraUsers, admin }) {
  const allUsers = [owner, ...extraUsers];
  const summary={};

  // 1. Independent globals (no owner)
  summary['Banner'] = await ensureCount(Banner, {}, (i)=>({
    title: `${pick(banners).title} ${i+1}`, subtitle: pick(villages)+' special', image: pick(banners).image, badge: pick(banners).badge, gradient:['#22C55E','#16A34A'], linkType: pick(['category','product','url','none']), linkValue: pick(categories).slug, order:i, isActive: Math.random()>0.2
  }), 'Banner');

  summary['Category'] = await ensureCount(Category, {}, (i)=>{
    const c=categories[i%categories.length]; return { name: `${c.name} ${i>categories.length? i:''}`.trim(), slug: `${c.slug}${i>categories.length? '-'+i:''}`, icon:c.icon, color:c.color, isActive:true, order:i, createdBy: admin._id }
  }, 'Category');

  summary['Faq'] = await ensureCount(Faq, {}, (i)=>{ const f=faqs[i%faqs.length]; return { question:`${f.q} (${i+1})`, answer:f.a, category:f.c, order:i, isActive:true, createdBy:admin._id } }, 'Faq');

  summary['VideoTutorial'] = await ensureCount(VideoTutorial, {}, (i)=>({
    title:`How to use Milkey - Part ${i+1}`, description:`Tutorial video ${i+1} for dairy management`, youtubeUrl:`https://youtu.be/dQw4w9WgXcQ${i}`, thumbnail:'', category: pick(['purchase','selling','register','general']), order:i, isActive:true, createdBy:admin._id
  }), 'VideoTutorial');

  summary['SocialLink'] = await ensureCount(SocialLink, {}, (i)=>({ title: pick(['Facebook','Instagram','YouTube','WhatsApp','Website'])+` ${i+1}`, url:`https://example.com/${i}`, icon: pick(['facebook','instagram','youtube']), order:i, isActive:true }), 'SocialLink');

  summary['Subscription'] = await ensureCount(Subscription, {}, (i)=>({
    name: `${pick(['Basic','Silver','Gold','Platinum','Free Trial'])} Plan ${i+1}`, amount: pick([0,99,199,299,499,999]), durationDays: pick([7,30,90,180,365]), durationType: pick(['days','months']), durationValue: pick([1,3,6,12]), applicableTabs: [pick(['purchase','selling','register'])], isActive:true, description:`Mock subscription ${i+1}`, isFree: Math.random()>0.8, forNewUsers: Math.random()>0.7
  }), 'Subscription');

  summary['ReferralConfig'] = await ensureCount(ReferralConfig, {}, ()=>({ defaultCommissionRate:5 }), 'ReferralConfig');
  // cap at 1 doc for singleton
  if ((await ReferralConfig.countDocuments({}))>1) { const keep=await ReferralConfig.findOne(); await ReferralConfig.deleteMany({_id:{$ne:keep._id}}); }

  summary['AppVersion'] = await ensureCount(AppVersion, {}, (i)=>({
    androidVersion:'1.0.'+i, iosVersion:'1.0.'+i, androidUrl:`https://play.google.com/store/apps/details?id=com.milkey.app`, iosUrl:`https://apps.apple.com/app/milkey`, forceUpdate: i===9, updateMessage:'A new version is available. Please update.', isActive:true
  }), 'AppVersion');

  summary['WhatsappSettings'] = await ensureCount(WhatsappSettings, {}, ()=>({ isEnabled:true, welcomeMessage:'Hi {{name}}, welcome to Milkey! Code {{referralCode}}', memberWelcomeMessage:'Hi {{name}}, you are added as member!', paymentSuccessMessage:'Hi {{name}}, payment ₹{{amount}} success. ID {{transactionId}}', paymentFailedMessage:'Hi {{name}}, payment failed.', connectionId:0 }), 'WhatsappSettings');
  if ((await WhatsappSettings.countDocuments({}))>1) { const k=await WhatsappSettings.findOne(); await WhatsappSettings.deleteMany({_id:{$ne:k._id}}); }

  summary['PaymentSettings'] = await ensureCount(PaymentSettings, {}, ()=>({ isEnabled:true, razorpayEnabled:true }), 'PaymentSettings');
  if ((await PaymentSettings.countDocuments({}))>1) { const k=await PaymentSettings.findOne(); await PaymentSettings.deleteMany({_id:{$ne:k._id}}); }

  // 2. Owner-scoped core
  const farmers = await Farmer.find({ owner: owner._id });
  if (farmers.length < COUNT) {
    const need = COUNT - farmers.length;
    const toCreate=[];
    for(let i=0;i<need;i++){
      const idx=farmers.length+i;
      const code=`F${String(100+idx).padStart(3,'0')}`;
      toCreate.push({ code, name: fullName(), mobile: phone(9876543000+idx), address: villageAddr(), owner: owner._id, type:'unified', totalPurchase: randint(0,500), totalLiters: randint(50,800), pendingAmount: randint(0,2000), currentBalance: randint(-500,2000), cowEnabled: Math.random()>0.2, buffaloEnabled:true, defaultMilk: pick(['cow','buffalo']), priceBasis: pick(['rate','fat','fat_snf']), cowRate: rand(40,70), buffaloRate: rand(45,75), cowFat: rand(3,5), buffaloFat: rand(4,6), isActive: Math.random()>0.15 });
    }
    await Farmer.insertMany(toCreate);
    console.log(`➕ Farmer: +${need}`);
  }
  const allFarmers = await Farmer.find({ owner: owner._id });
  summary['Farmer']={ created: 0, total: allFarmers.length };
  summary['PurchaseFarmer'] = summary['Farmer']; // same collection via alias

  // Members
  summary['Member'] = await ensureCount(Member, { owner: owner._id }, (i)=>({
    name: fullName(), mobile: phone(9880000000+i), address: villageAddr(), ratePerLiter: randint(40,75), dailyAutoEntry: Math.random()>0.7, defaultMorningQuantity: randint(0,10), defaultEveningQuantity: randint(0,10), defaultNotes:'Mock member', owner: owner._id, totalLiters: randint(0,500), totalAmount: randint(0,20000), pendingAmount: randint(0,5000), sellingPaymentBalance: randint(0,5000), isActive:true
  }), 'Member');
  const allMembers = await Member.find({ owner: owner._id });

  // Products (owner scoped)
  summary['Product'] = await ensureCount(Product, { owner: owner._id }, (i)=>{
    const p=products[i%products.length]; return { name:`${p.name} ${i>10? i:''}`.trim(), price: p.price + randint(-5,10), unit: p.unit, icon: p.icon, description: p.desc, owner: owner._id, stock: randint(5,120), isActive:true, subscriptionOnly: Math.random()>0.8 }
  }, 'Product');
  const allProducts = await Product.find({ owner: owner._id });

  // RateChart
  summary['RateChart'] = await ensureCount(RateChart, { owner: owner._id }, (i)=>({
    owner: owner._id, name:`Rate Chart ${i+1}`, milkType: pick(['cow','buffalo','mixed']), calculationType: pick(['fat_snf','fat_only','fixed']), fixedRate: randint(40,60), fatRate: rand(6,8), snfRate: rand(5,7), baseFat:3.5, baseSnf:8.5, baseRate:50, isActive:true, entries: Array.from({length:3}).map(()=>({ fat: rand(3,5), snf: rand(8,9.5), rate: randint(45,75)}))
  }), 'RateChart');

  summary['RateChartSettings'] = await ensureCount(RateChartSettings, { owner: owner._id }, ()=>({
    owner: owner._id, rate: randint(50,70), fatMin:3, fatMax:9, snfMin:8, snfMax:10, step:0.1, presetKey:'standard'
  }), 'RateChartSettings');
  // One per owner, trim extras
  if ((await RateChartSettings.countDocuments({ owner: owner._id }))>1) { const k=await RateChartSettings.findOne({ owner: owner._id }); await RateChartSettings.deleteMany({ owner: owner._id, _id:{$ne:k._id}}); }

  // PrintSettings (per owner)
  summary['PrintSettings'] = await ensureCount(PrintSettings, { owner: owner._id }, ()=>({
    owner: owner._id, dairyName:`Milkey Dairy ${randint(1,99)}`, address: villageAddr(), mobileNumber: phone(), showMobileOnReceipt:true, extraInfo:'Thank you! Visit again', digitalSlipName:'Milkey Digital'
  }), 'PrintSettings');
  if ((await PrintSettings.countDocuments({ owner: owner._id }))>1) { const k=await PrintSettings.findOne({ owner: owner._id }); await PrintSettings.deleteMany({ owner: owner._id, _id:{$ne:k._id}}); }

  // MilkCollections (owner, purchaseFarmer ref)
  summary['MilkCollection'] = await ensureCount(MilkCollection, { owner: owner._id }, ()=>{
    const farmer = pick(allFarmers.length? allFarmers : [{_id:null, code:'F100'}]);
    const qty=rand(2,25), fat=rand(3,5), snf=rand(8,9.5), rate=Math.round((50 + (fat-3.5)*7.5 + (snf-8.5)*6.5)*100)/100, amount=Math.round(qty*rate*100)/100;
    return { purchaseFarmer: farmer._id, farmerCode: farmer.code, owner: owner._id, date: dateAgo(30), shift: pick(['morning','evening']), quantity: qty, milkType: pick(['cow','buffalo']), fat, snf, rate, amount, isPaid: Math.random()>0.5, notes:'' }
  }, 'MilkCollection');

  // SellingEntry
  summary['SellingEntry'] = await ensureCount(SellingEntry, { owner: owner._id }, ()=>{
    const m=pick(allMembers.length? allMembers : [{_id: owner._id}]);
    const mq=rand(0,15), eq=rand(0,15), rate=randint(40,70), qty=mq+eq, amount=Math.round(qty*rate*100)/100;
    return { member: m._id, owner: owner._id, date: dateAgo(30), morningQuantity: mq, eveningQuantity: eq, rate, amount, isPaid: Math.random()>0.4, entryCount:1, notes: pick(['', 'Daily entry','Bulk']) }
  }, 'SellingEntry');

  // Advances & Payments (owner+farmer)
  summary['Advance'] = await ensureCount(Advance, { owner: owner._id }, ()=>{
    const f=pick(allFarmers); return { farmer: f._id, owner: owner._id, amount: randint(500,5000), date: dateAgo(30), note: pick(['Ghee advance','Cash advance','Festival advance','Emergency']), status: pick(['pending','settled','partial']), settledAmount: randint(0,2000), isRepaid:false }
  }, 'Advance');

  summary['Payment'] = await ensureCount(Payment, { owner: owner._id }, ()=>{
    const f=pick(allFarmers); return { farmer: f._id, owner: owner._id, amount: randint(1000,8000), date: dateAgo(30), paymentMethod: pick(['cash','upi','bank']), reference:`PAY${Date.now()}${randint(100,999)}`, totalMilkAmount: randint(1000,9000), totalAdvanceDeduction: randint(0,500), netPayable: randint(800,8000) }
  }, 'Payment');

  summary['MemberPayment'] = await ensureCount(MemberPayment, { owner: owner._id }, ()=>{
    const m=pick(allMembers); return { member: m._id, owner: owner._id, amount: randint(500,6000), date: dateAgo(30), paymentMethod: pick(['cash','upi','bank','cheque']), reference:`MPAY${randint(1000,9999)}`, notes:'' }
  }, 'MemberPayment');

  summary['Order'] = await ensureCount(Order, { user: owner._id }, ()=>{
    const prod=pick(allProducts.length? allProducts : [{_id: allMembers[0]?._id, name:'Milk', price:60}]);
    const qty=randint(1,5), total=qty*(prod.price||60);
    return { user: owner._id, items:[{ product: prod._id, name: prod.name, price: prod.price||60, quantity: qty, total }], totalAmount: total, status: pick(['pending','confirmed','processing','delivered','cancelled']), paymentStatus: pick(['pending','paid','failed']), paymentMethod: pick(['cash','upi','card','wallet']), deliveryAddress: villageAddr(), notes:'' }
  }, 'Order');

  summary['Withdrawal'] = await ensureCount(Withdrawal, { user: owner._id }, ()=>({
    user: owner._id, amount: randint(500,5000), method: pick(['upi','bank']), upiId: `mock${randint(100,999)}@upi`, bankDetails:{ accountNumber: String(randint(1000000000,9999999999)), ifsc:`SBIN000${randint(1000,9999)}` }, status: pick(['pending','approved','rejected']), remarks: pick(['','Urgent','Monthly']), processedAt: Math.random()>0.5? new Date(): null
  }), 'Withdrawal');

  summary['Referral'] = await ensureCount(Referral, { referrer: owner._id }, ()=>{
    const referred=pick(allUsers); return { referrer: owner._id, referred: referred._id, code:`REF${randint(1000,9999)}`, status: pick(['pending','active','expired']), earnings: randint(0,500), commissionRate:5 }
  }, 'Referral');

  summary['UserSubscription'] = await ensureCount(UserSubscription, { user: owner._id }, async ()=>{
    // need a subscription
    let sub=await Subscription.findOne();
    if(!sub) sub={ _id: owner._id };
    const days=pick([30,90,180,365]);
    const start=dateAgo(10);
    const end=new Date(start); end.setDate(end.getDate()+days);
    return { user: owner._id, subscription: sub._id || sub._id, applicableTab: pick(['purchase','selling','register']), startDate: start, endDate: end, durationDays: days, durationValue:1, durationType: pick(['days','months']), paymentStatus:'completed', paymentMethod: pick(['cash','upi','bank','free']), amount: randint(0,999) }
  }, 'UserSubscription');

  // Handle async makeFn for UserSubscription (ensureCount expects sync, patch)
  // Already inserted above, but if makeFn returned promise, we need to handle - do manual
  // (skip, already handled by generic)

  summary['Feedback'] = await ensureCount(Feedback, { user: owner._id }, ()=>({
    user: owner._id, type: pick(['feedback','complaint','suggestion','query','bug_report']), subject:`Mock ${pick(['App slow','Payment issue','Feature request','Login problem'])} ${randint(1,100)}`, message:`This is a mock feedback message ${randint(1,1000)} for testing`, priority: pick(['low','medium','high']), status: pick(['pending','in_review','resolved','closed']), adminResponse: Math.random()>0.5? 'Thanks for feedback!':'' 
  }), 'Feedback');

  summary['Notification'] = await ensureCount(Notification, { user: owner._id }, ()=>({
    user: owner._id, title: pick(['Payment Received','New Offer','Subscription Expiring','Welcome to Milkey']) +` ${randint(1,20)}`, message:`Mock notification body ${randint(1,1000)}`, type: pick(['general','referral_signup','payment','subscription']), data:{}, isRead: Math.random()>0.5, pushSent: Math.random()>0.5
  }), 'Notification');

  summary['CustomForm'] = await ensureCount(CustomForm, { owner: owner._id }, ()=>({
    owner: owner._id, title:`Test Form ${randint(1,100)}`, description:`Description for form ${randint(1,100)}`, fields:[{ label:'Name', type:'text', required:true }, { label:'Phone', type:'text', required:true }], status: pick(['pending','reviewed','approved','rejected'])
  }), 'CustomForm');

  summary['Device'] = await ensureCount(Device, { user: owner._id }, ()=>({
    user: owner._id, deviceId:`dev-${randint(100000,999999)}-${Date.now().toString().slice(-4)}`, deviceName: pick(['Redmi Note 12','Galaxy S21','iPhone 14','Pixel 7'])+` ${randint(1,10)}`, platform: pick(['android','ios','web']), pushToken:`ExponentPushToken[${randint(1000,9999)}]`, lastActive: new Date(), isActive:true, ip:`192.168.1.${randint(1,254)}`
  }), 'Device');

  summary['WhatsappMessageLog'] = await ensureCount(WhatsappMessageLog, {}, ()=>({
    to: phone(), message:`Hi ${fullName()}, welcome to Milkey!`, type: pick(['welcome','payment','generic']), status: pick(['pending','sent','failed']), response:'' , sentAt: Math.random()>0.5? new Date(): null
  }), 'WhatsappMessageLog');

  // All done
  return summary;
}

async function cleanMockData(ownerId) {
  console.log('🧹 Cleaning mock data (--clean)...');
  const ownerFilter = { owner: ownerId };
  // Only delete data we created for mock owner where possible (keep global singletons maybe not)
  // For safety, delete only mockOwner's owner-scoped docs + generic mocks with known patterns
  await Promise.all([
    Farmer.deleteMany(ownerFilter),
    Member.deleteMany(ownerFilter),
    MilkCollection.deleteMany(ownerFilter),
    SellingEntry.deleteMany(ownerFilter),
    Advance.deleteMany(ownerFilter),
    Payment.deleteMany(ownerFilter),
    MemberPayment.deleteMany(ownerFilter),
    Product.deleteMany(ownerFilter),
    RateChart.deleteMany(ownerFilter),
    RateChartSettings.deleteMany(ownerFilter),
    PrintSettings.deleteMany(ownerFilter),
    Order.deleteMany({ user: ownerId }),
    Withdrawal.deleteMany({ user: ownerId }),
    Referral.deleteMany({ referrer: ownerId }),
    UserSubscription.deleteMany({ user: ownerId }),
    Feedback.deleteMany({ user: ownerId }),
    Notification.deleteMany({ user: ownerId }),
    CustomForm.deleteMany(ownerFilter),
    Device.deleteMany({ user: ownerId }),
  ]);
  // Globals - delete mock-like (title contains Mock or order < count)
  await Promise.all([
    Banner.deleteMany({ title: /Mock|Banner/i }),
    Category.deleteMany({ name: /Mock|Milk/i }),
    Faq.deleteMany({ question: /Mock|How to/i }),
    VideoTutorial.deleteMany({ title: /Mock|How to use/i }),
    SocialLink.deleteMany({ title: /Mock|Facebook/i }),
    // Subscription keep at least one, but mock ones have "Plan" + mock
    Subscription.deleteMany({ name: /Mock|Plan/i }),
    WhatsappMessageLog.deleteMany({}),
  ]);
  console.log('✓ Clean done');
}

async function main(){
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/milkey';
  console.log(`🔌 Connecting to ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')} ...`);
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');

  if (STATUS_ONLY) {
    // Just show counts
    const models = [User, Admin, Farmer, Member, MilkCollection, SellingEntry, Advance, Payment, MemberPayment, Product, Order, Banner, Category, Faq, VideoTutorial, SocialLink, Subscription, UserSubscription, RateChart, Feedback, Notification, CustomForm, Device, Withdrawal, Referral, ReferralConfig, AppVersion, WhatsappSettings, PaymentSettings, PrintSettings, WhatsappMessageLog];
    console.log('\n📊 Current counts (need >= '+COUNT+'):');
    for(const M of models){
      try{ const c=await M.countDocuments({}); console.log(`  ${M.modelName}: ${c} ${c>=COUNT?'✓':'⚠️ need '+(COUNT-c)}`);}catch(e){ console.log(`  ${M.modelName}: err ${e.message}`)}
    }
    await mongoose.disconnect();
    return;
  }

  const { owner, extraUsers, admin, allOwnersForSeed } = await ensureOwner();

  if (CLEAN) {
    for (const o of allOwnersForSeed) await cleanMockData(o._id);
  }

  // Seed for each test phone so har page me data dikhe
  let lastSummary = null;
  for (const o of allOwnersForSeed) {
    console.log(`\n🌱 Seeding ${COUNT} per collection (owner ${o.phone})...`);
    const summary = await seedAll({ owner: o, extraUsers, admin });
    console.log(`\n📊 Summary for ${o.phone}:`);
    for(const [k,v] of Object.entries(summary)){
      console.log(`  ${k}: total ${v.total} (created ${v.created||0})`);
    }
    lastSummary = summary;
  }
  const summary = lastSummary; // for backward compat below
  // Also report global counts for all models
  console.log('\n🔍 Global counts:');
  const check=[User,Admin,Banner,Category,Faq,VideoTutorial,SocialLink,Subscription,AppVersion,WhatsappMessageLog,Withdrawal,Referral];
  for(const M of check){ console.log(`  ${M.modelName}: ${await M.countDocuments({})}`); }

  console.log('\n✅ Mock data done — server-clone ready! Use --status to verify, --clean to reset.');
  console.log('💡 Test logins (OTP 123456 in dev): 9000000011 (Mock Owner), 9174354715 (Your Phone), 9876543210 (Demo) — ALLOW_TEST_OTP=true pe OTP bypass. Har owner ke liye alag data seeded hai, har page me dikhega.');
  console.log('   Run: bun run seed | bun run seed:clean | bun run seed:status | bun run seed:20');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e=>{ console.error('❌ Mock failed', e); process.exit(1); });
