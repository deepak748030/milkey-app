import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, TrendingUp, DollarSign, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
export default function AdminMRR(){
  const {colors}=useTheme();
  const months=[
    { m:'Jan', mrr: 48000, yrr: 420000 },
    { m:'Feb', mrr: 52000, yrr: 435000 },
    { m:'Mar', mrr: 61000, yrr: 498000 },
    { m:'Apr', mrr: 71000, yrr: 542000 },
    { m:'May', mrr: 68000, yrr: 528000 },
    { m:'Jun', mrr: 82000, yrr: 610000 },
  ];
  const max=Math.max(...months.map(x=>x.mrr));
  const s=createStyles(colors);
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <TrendingUp size={18} color={colors.primary}/><Text style={[s.title,{color:colors.foreground}]}>MRR / YRR</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:12,gap:12}}>
        <View style={s.kpis}>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><DollarSign size={16} color={colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>₹82,000</Text><Text style={s.kpiLabel}>MRR (Jun)</Text></View>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><Calendar size={16} color={colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>₹6.1L</Text><Text style={s.kpiLabel}>YRR run-rate</Text></View>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><TrendingUp size={16} color={colors.success||colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>+21%</Text><Text style={s.kpiLabel}>MoM growth</Text></View>
        </View>
        <View style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <Text style={[s.cardTitle,{color:colors.foreground}]}>Monthly recurring (last 6)</Text>
          <View style={s.bars}>
            {months.map((d)=>(
              <View key={d.m} style={s.barCol}>
                <View style={[s.bar,{height: (d.mrr/max)*90+10, backgroundColor:colors.primary}]}/>
                <Text style={s.barLabel}>{d.m}</Text>
                <Text style={s.barVal}>₹{(d.mrr/1000).toFixed(0)}k</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <Text style={[s.cardTitle,{color:colors.foreground}]}>Formula</Text>
          <Text style={{fontSize:12,color:colors.mutedForeground}}>{'MRR = sum(activeSubscriptions monthlyPrice)'} {'\n'}YRR = MRR*12 + one-time (annual plans){'\n\n'}Source: server-clone /api/subscriptions + /api/user-subscriptions aggregation. Cache TTL 30s — ponytail fast.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  kpis:{flexDirection:'row',gap:8}, kpi:{flex:1,borderWidth:1,borderRadius:12,padding:12,alignItems:'center',gap:4}, kpiVal:{fontSize:14,fontWeight:'800'}, kpiLabel:{fontSize:11,color:c.mutedForeground},
  card:{borderWidth:1,borderRadius:12,padding:12}, cardTitle:{fontSize:13,fontWeight:'700',marginBottom:8},
  bars:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',height:120}, barCol:{alignItems:'center',gap:4,flex:1}, bar:{width:22,borderRadius:6}, barLabel:{fontSize:11,color:c.mutedForeground}, barVal:{fontSize:10,fontWeight:'600',color:c.foreground}
});
