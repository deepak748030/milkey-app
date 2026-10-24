import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, HelpCircle, Video, LayoutDashboard, Shield, Tag, Smartphone, Bell, UsersRound, TrendingUp, Activity } from 'lucide-react-native';
import { router } from 'expo-router';

export default function AdminHub(){
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <LayoutDashboard size={18} color={colors.primary}/>
        <Text style={[s.title,{color:colors.foreground}]}>Admin Panel</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:12,gap:12}}>
        <View style={[s.infoCard,{backgroundColor:colors.primary+'12',borderColor:colors.primary+'30'}]}>
          <Shield size={16} color={colors.primary}/>
          <Text style={[s.infoText,{color:colors.foreground}]}>Manage Home content. Changes reflect instantly on Home (FAQ top 5 + Video horizontal). Server-clone lightning fast.</Text>
        </View>
        <Pressable onPress={()=>router.push('/admin/faqs' as any)} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><HelpCircle size={20} color={colors.primary}/></View>
          <View style={{flex:1}}><Text style={[s.cardTitle,{color:colors.foreground}]}>FAQs</Text><Text style={[s.cardSub,{color:colors.mutedForeground}]}>Add/edit/delete FAQs — shown in Home FAQ section</Text></View>
        </Pressable>
        <Pressable onPress={()=>router.push('/admin/videos' as any)} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><Video size={20} color={colors.primary}/></View>
          <View style={{flex:1}}><Text style={[s.cardTitle,{color:colors.foreground}]}>Video Tutorials</Text><Text style={[s.cardSub,{color:colors.mutedForeground}]}>YouTube links — shown in Home Video section</Text></View>
        </Pressable>
        <Pressable onPress={()=>router.push('/admin/categories' as any)} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><Tag size={20} color={colors.primary}/></View>
          <View style={{flex:1}}><Text style={[s.cardTitle,{color:colors.foreground}]}>Categories</Text><Text style={[s.cardSub,{color:colors.mutedForeground}]}>Product & collection categories — inventory grouping</Text></View>
        </Pressable>

        <Text style={[s.sectionTitle,{color:colors.foreground}]}>Admin Operations</Text>
        <View style={s.grid}>
          <Pressable onPress={()=>router.push('/admin/dau' as any)} style={[s.gridCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <Activity size={18} color={colors.primary}/><Text style={[s.gridTitle,{color:colors.foreground}]}>DAU</Text><Text style={[s.gridSub,{color:colors.mutedForeground}]}>Daily active users</Text>
          </Pressable>
          <Pressable onPress={()=>router.push('/admin/notifications' as any)} style={[s.gridCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <Bell size={18} color={colors.primary}/><Text style={[s.gridTitle,{color:colors.foreground}]}>Notifications</Text><Text style={[s.gridSub,{color:colors.mutedForeground}]}>Push & in-app</Text>
          </Pressable>
          <Pressable onPress={()=>router.push('/admin/roles' as any)} style={[s.gridCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <UsersRound size={18} color={colors.primary}/><Text style={[s.gridTitle,{color:colors.foreground}]}>Roles</Text><Text style={[s.gridSub,{color:colors.mutedForeground}]}>Owner/Staff/Farmer</Text>
          </Pressable>
          <Pressable onPress={()=>router.push('/admin/mrr' as any)} style={[s.gridCard,{backgroundColor:colors.card,borderColor:colors.border}]}>
            <TrendingUp size={18} color={colors.primary}/><Text style={[s.gridTitle,{color:colors.foreground}]}>MRR / YRR</Text><Text style={[s.gridSub,{color:colors.mutedForeground}]}>Revenue metrics</Text>
          </Pressable>
        </View>
        <Pressable onPress={()=>router.push('/devices' as any)} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><Smartphone size={20} color={colors.primary}/></View>
          <View style={{flex:1}}><Text style={[s.cardTitle,{color:colors.foreground}]}>Device Management</Text><Text style={[s.cardSub,{color:colors.mutedForeground}]}>Login tracking & logout other devices</Text></View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  infoCard:{flexDirection:'row',gap:8,borderWidth:1,borderRadius:10,padding:12,alignItems:'center'}, infoText:{flex:1,fontSize:12,lineHeight:16},
  card:{flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderRadius:12,padding:14}, iconBox:{width:44,height:44,borderRadius:10,alignItems:'center',justifyContent:'center'}, cardTitle:{fontSize:14,fontWeight:'700'}, cardSub:{fontSize:12,marginTop:2},
  sectionTitle:{fontSize:13, fontWeight:'700', marginTop:6, marginBottom:2 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  gridCard:{ width:'48%', borderWidth:1, borderRadius:12, padding:12, gap:6, alignItems:'center' },
  gridTitle:{fontSize:13,fontWeight:'700'}, gridSub:{fontSize:11, textAlign:'center'}
});
