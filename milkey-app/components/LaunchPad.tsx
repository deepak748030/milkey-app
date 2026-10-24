import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Users, ShoppingCart, ClipboardList, BarChart3, Megaphone, Wallet, Package } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSubTabStore } from '@/lib/subTabStore';

export default function LaunchPad(){
  const { colors } = useTheme();
  // quick actions that open correct bottom tab + sheet item
  const items = [
    { label:'Add Farmer', icon:Users, color:'#2E7D32', bg:'#E8F5E9', action:()=> router.push('/(tabs)/purchase' as any) },
    { label:'Purchase', icon:ShoppingCart, color:'#EF6C00', bg:'#FFF3E0', action:()=> router.push('/(tabs)/purchase' as any) },
    { label:'Payment', icon:Wallet, color:'#1565C0', bg:'#E3F2FD', action:()=> router.push('/(tabs)/register' as any) },
    { label:'Orders', icon:Package, color:'#6A1B9A', bg:'#F3E5F5', action:()=> router.push('/orders' as any) },
    { label:'Reports', icon:BarChart3, color:'#00838F', bg:'#E0F7FA', action:()=> router.push('/(tabs)/register' as any) },
    { label:'Products', icon:ClipboardList, color:'#4E342E', bg:'#EFEBE9', action:()=> router.push('/products' as any) },
    { label:'Invite', icon:Megaphone, color:'#C62828', bg:'#FFEBEE', action:()=> router.push('/referral' as any) },
    { label:'More', icon:BarChart3, color:'#37474F', bg:'#ECEFF1', action:()=> router.push('/(tabs)/profile' as any) },
  ];
  const s=createStyles(colors);
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Launch Pad</Text>
      <View style={s.grid}>
        {items.map((it,i)=>{
          const Icon=it.icon;
          return (
            <Pressable key={i} onPress={it.action} style={({pressed})=>[s.card,{backgroundColor: colors.card, borderColor: colors.border}, pressed&&{opacity:0.85}]}>
              <View style={[s.iconBox,{backgroundColor:it.bg}]}><Icon size={18} color={it.color}/></View>
              <Text style={s.label}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  wrap:{ marginTop:14, paddingHorizontal:2 },
  title:{ fontSize:14, fontWeight:'700', color:c.foreground, marginBottom:8 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  card:{ width:'23%', minWidth:80, borderWidth:1, borderRadius:12, paddingVertical:10, alignItems:'center', gap:6 },
  iconBox:{ width:38, height:38, borderRadius:10, alignItems:'center', justifyContent:'center' },
  label:{ fontSize:11, fontWeight:'600', color:c.foreground, textAlign:'center' },
});
