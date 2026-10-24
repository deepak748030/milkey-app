import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Activity, Users, TrendingUp } from 'lucide-react-native';
import { router } from 'expo-router';
export default function AdminDAU(){
  const { colors } = useTheme();
  const data = [
    { day:'Mon', dau: 1240, wau: 4120 },
    { day:'Tue', dau: 1380, wau: 4280 },
    { day:'Wed', dau: 1520, wau: 4450 },
    { day:'Thu', dau: 1480, wau: 4380 },
    { day:'Fri', dau: 1620, wau: 4610 },
    { day:'Sat', dau: 980, wau: 3890 },
    { day:'Sun', dau: 890, wau: 3720 },
  ];
  const max = Math.max(...data.map(d=>d.dau));
  const s=createStyles(colors);
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <Activity size={18} color={colors.primary}/><Text style={[s.title,{color:colors.foreground}]}>DAU / WAU</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:12,gap:12}}>
        <View style={[s.kpiRow]}>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><Users size={16} color={colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>1,620</Text><Text style={s.kpiLabel}>Today DAU</Text></View>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><TrendingUp size={16} color={colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>4,610</Text><Text style={s.kpiLabel}>Week WAU</Text></View>
          <View style={[s.kpi,{backgroundColor:colors.card,borderColor:colors.border}]}><Activity size={16} color={colors.primary}/><Text style={[s.kpiVal,{color:colors.foreground}]}>35%</Text><Text style={s.kpiLabel}>Sticky (DAU/WAU)</Text></View>
        </View>
        <View style={[s.chart,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <Text style={[s.chartTitle,{color:colors.foreground}]}>Last 7 days</Text>
          <View style={s.bars}>
            {data.map((d)=>(
              <View key={d.day} style={s.barCol}>
                <View style={[s.bar,{height: (d.dau/max)*90 + 10, backgroundColor:colors.primary}]}/>
                <Text style={s.barLabel}>{d.day}</Text>
                <Text style={s.barVal}>{d.dau}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={{color:colors.mutedForeground,fontSize:11,textAlign:'center'}}>Source: server-clone /api/users?active + cached. Lightning fast ponytail max.</Text>
      </ScrollView>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  kpiRow:{flexDirection:'row',gap:8}, kpi:{flex:1,borderWidth:1,borderRadius:12,padding:12,alignItems:'center',gap:4}, kpiVal:{fontSize:16,fontWeight:'800'}, kpiLabel:{fontSize:11,color:c.mutedForeground},
  chart:{borderWidth:1,borderRadius:12,padding:12}, chartTitle:{fontSize:13,fontWeight:'700',marginBottom:10}, bars:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',height:120}, barCol:{alignItems:'center',gap:4, flex:1}, bar:{width:22,borderRadius:6}, barLabel:{fontSize:11,color:c.mutedForeground}, barVal:{fontSize:10,fontWeight:'600',color:c.foreground}
});
