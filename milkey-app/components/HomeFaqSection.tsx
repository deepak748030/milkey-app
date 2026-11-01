import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { ChevronDown, HelpCircle } from 'lucide-react-native';
import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';

const DEFAULT_FAQS = [
  { _id: 'default-1', question: 'How do I add a new farmer?', answer: 'Go to Collection → Farmer, tap Add Farmer, fill code, name, mobile, select milk type and price basis, then save.' },
  { _id: 'default-2', question: 'How to record milk collection?', answer: 'Open Collection → Purchase, select farmer by code, enter quantity, FAT/SNF, rate auto-calculates (or enter manually), then Save.' },
  { _id: 'default-3', question: 'What is Rate Setting?', answer: 'Rate Setting calculates price from FAT & SNF using your dairy rate. Set today rate in Collection → Rate Setting and enable per farmer.' },
  { _id: 'default-4', question: 'How to do farmer payments?', answer: 'Go to Collection → Report or Register → Payments, select date range, review totals, and process payment. You can print the slip.' },
  { _id: 'default-5', question: 'How to add advances?', answer: 'Open Register → Advances, select farmer code, enter amount and date, save. It auto-adjusts in next payment.' },
];

export default memo(function HomeFaqSection() {
  const { colors } = useTheme();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/faqs`).then(r=>r.json()).then(d=>{
      const list = d?.success ? (d.response?.slice(0,5) || []) : [];
      setFaqs(list.length ? list : DEFAULT_FAQS);
    }).catch(()=> setFaqs(DEFAULT_FAQS)).finally(()=>setLoading(false));
  },[]);
  const styles = createStyles(colors);
  if (loading) return <View style={styles.wrap}><ActivityIndicator color={colors.primary} /></View>;
  const display = faqs.length ? faqs : DEFAULT_FAQS;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}><HelpCircle size={16} color={colors.primary} /><Text style={styles.title}>FAQs</Text></View>
      {display.map(f=>(
        <Pressable key={f._id} onPress={()=>setOpenId(openId===f._id?null:f._id)} style={styles.card}>
          <View style={styles.row}><Text style={styles.q}>{f.question}</Text><ChevronDown size={16} color={colors.mutedForeground} style={{ transform:[{ rotate: openId===f._id?'180deg':'0deg'}]}} /></View>
          {openId===f._id && <Text style={styles.a}>{f.answer}</Text>}
        </Pressable>
      ))}
    </View>
  );
});
const createStyles=(c:any)=>StyleSheet.create({
  wrap:{ marginTop:14, paddingHorizontal:2 },
  header:{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:8 },
  title:{ fontSize:14, fontWeight:'700', color:c.foreground },
  card:{ backgroundColor:c.card, borderWidth:1, borderColor:c.border, borderRadius:10, padding:12, marginBottom:8 },
  row:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', gap:8 },
  q:{ flex:1, fontSize:13, fontWeight:'600', color:c.foreground },
  a:{ marginTop:8, fontSize:12, color:c.mutedForeground, lineHeight:18 },
});
