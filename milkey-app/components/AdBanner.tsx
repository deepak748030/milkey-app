import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { X, Megaphone } from 'lucide-react-native';

type Props = { placement?: 'home'|'collection'|'selling'; onClose?:()=>void };

export default function AdBanner({ placement='home', onClose }: Props){
  const { colors, isDark } = useTheme();
  const [closed, setClosed] = useState(false);
  if(closed) return null;
  const s = createStyles(colors, isDark);
  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <View style={s.badge}><Text style={s.badgeText}>AD</Text></View>
        <Megaphone size={18} color={colors.primary} />
        <View style={{flex:1}}>
          <Text style={s.title}>Boost your dairy with Milkey Premium</Text>
          <Text style={s.sub}>Get unlimited reports & priority support — 7 day free trial</Text>
        </View>
        <Pressable onPress={()=> Linking.openURL('https://milkey.app/premium')} style={s.cta}><Text style={s.ctaText}>View</Text></Pressable>
        <Pressable onPress={()=>{ setClosed(true); onClose?.(); }} style={s.close}><X size={14} color={colors.mutedForeground}/></Pressable>
      </View>
      <Text style={s.hint}>Ad · Personalized · {placement}</Text>
    </View>
  );
}
const createStyles=(c:any, isDark:boolean)=>StyleSheet.create({
  wrap:{ marginHorizontal:6, marginTop:8 },
  card:{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor: c.card, borderWidth:1, borderColor: c.border, borderRadius:12, padding:10, paddingVertical:12 },
  badge:{ backgroundColor:'#FFEB3B', paddingHorizontal:6, paddingVertical:2, borderRadius:6 }, badgeText:{ fontSize:10, fontWeight:'800', color:'#000' },
  title:{ fontSize:13, fontWeight:'700', color:c.foreground }, sub:{ fontSize:11, color:c.mutedForeground, marginTop:1 },
  cta:{ backgroundColor:c.primary, paddingHorizontal:10, paddingVertical:6, borderRadius:8 }, ctaText:{ color:'#fff', fontWeight:'700', fontSize:12 },
  close:{ width:24, height:24, borderRadius:12, backgroundColor: isDark?'rgba(255,255,255,0.08)':'#F5F5F5', alignItems:'center', justifyContent:'center' },
  hint:{ fontSize:10, color:c.mutedForeground, marginTop:4, textAlign:'center' }
});
