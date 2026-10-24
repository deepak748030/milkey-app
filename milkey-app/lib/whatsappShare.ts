import { Linking, Alert, Platform } from 'react-native';
export function buildWhatsappUrl(phoneOrGroup:string, text:string){
  const clean = phoneOrGroup.replace(/[^\d]/g,'');
  const msg = encodeURIComponent(text);
  // Use wa.me for universal
  if(clean) return `https://wa.me/${clean}?text=${msg}`;
  return `https://wa.me/?text=${msg}`;
}
export async function shareViaWhatsapp(phone:string, text:string){
  const url = buildWhatsappUrl(phone, text);
  const can = await Linking.canOpenURL(url);
  if(can) await Linking.openURL(url);
  else Alert.alert('WhatsApp not installed','Please install WhatsApp to share');
}
export function paymentSlipText(farmer:{code:string,name:string}, period:{start:string,end:string}, milkAmount:number, advance:number, payable:number, paid:number, closing:number){
  return `*Milkey - Payment Slip*\nFarmer: ${farmer.code} ${farmer.name}\nPeriod: ${period.start} to ${period.end}\nMilk Amount: Rs ${milkAmount.toFixed(2)}\nAdvance: Rs ${advance.toFixed(2)}\nPayable: Rs ${payable.toFixed(2)}\nPaid: Rs ${paid.toFixed(2)}\nClosing: Rs ${closing.toFixed(2)}\n— Sent via Milkey`;
}
