import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Bell, Send } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuthToken } from '@/lib/authStore';
import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';
export default function AdminNotifications(){
  const {colors}=useTheme();
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [sending,setSending]=useState(false);
  const send=async()=>{
    if(!title.trim()||!body.trim()){ Alert.alert('Error','Title and body required'); return; }
    setSending(true);
    try{
      const token=await getAuthToken();
      const r=await fetch(`${API_BASE}/notifications/send`,{ method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ title, body })});
      const d=await r.json();
      if(d.success) Alert.alert('Sent','Notification queued');
      else Alert.alert('Error', d.message||'Failed');
    }catch{ Alert.alert('Error','Failed'); } finally{ setSending(false); }
  };
  const s=createStyles(colors);
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <Bell size={18} color={colors.primary}/><Text style={[s.title,{color:colors.foreground}]}>Send Notification</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:12,gap:12}}>
        <View style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <Text style={[s.label,{color:colors.foreground}]}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Payment reminder" placeholderTextColor={colors.mutedForeground} style={[s.input,{borderColor:colors.border,color:colors.foreground,backgroundColor:colors.background}]}/>
          <Text style={[s.label,{color:colors.foreground}]}>Body</Text>
          <TextInput value={body} onChangeText={setBody} placeholder="Your payment is due..." placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} style={[s.input,{borderColor:colors.border,color:colors.foreground,backgroundColor:colors.background,height:80}]}/>
          <Pressable onPress={send} disabled={sending} style={[s.send,{backgroundColor:colors.primary}]}>{sending? <ActivityIndicator color="#fff"/>:<><Send size={16} color="#fff"/><Text style={s.sendText}>Broadcast to all</Text></>}</Pressable>
          <Text style={{fontSize:11,color:colors.mutedForeground,textAlign:'center'}}>Uses expoPushToken from User model — server fans out via /api/notifications/send</Text>
        </View>
        <View style={[s.card,{backgroundColor:colors.primary+'12',borderColor:colors.primary+'30'}]}>
          <Text style={[s.label,{color:colors.foreground}]}>Tips</Text>
          <Text style={{fontSize:12,color:colors.mutedForeground}}>- Keep under 40 chars title, 120 body{'\n'}- Test on one device via targeted send{'\n'}- Schedule via server cron for DAU re-engagement</Text>
        </View>
      </ScrollView>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  card:{borderWidth:1,borderRadius:12,padding:12,gap:8}, label:{fontSize:12,fontWeight:'600'}, input:{borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:8,fontSize:13},
  send:{height:42,borderRadius:10,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8}, sendText:{color:'#fff',fontWeight:'700'}
});
