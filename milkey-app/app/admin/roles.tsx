import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, UsersRound, Shield, Crown, UserCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuthToken } from '@/lib/authStore';
import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';
export default function AdminRoles(){
  const {colors}=useTheme();
  const [users,setUsers]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const fetchUsers=async()=>{
    try{
      const token=await getAuthToken();
      const r=await fetch(`${API_BASE}/admin/users`,{headers:{Authorization:`Bearer ${token}`}});
      const d=await r.json(); if(d.success) setUsers(d.response||d.users||[]);
      else { // fallback to /users
        const r2=await fetch(`${API_BASE}/users`,{headers:{Authorization:`Bearer ${token}`}});
        const d2=await r2.json(); if(d2.success) setUsers(d2.response||[]);
      }
    }catch{} finally{ setLoading(false); }
  };
  useEffect(()=>{fetchUsers();},[]);
  const changeRole=async(id:string, role:string)=>{
    Alert.alert('Change role',`Set to ${role}?`,[{text:'Cancel'}, {text:'Change', onPress: async()=>{
      const token=await getAuthToken();
      await fetch(`${API_BASE}/admin/users/${id}/role`,{ method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ role })});
      fetchUsers();
    }}]);
  };
  const s=createStyles(colors);
  const iconFor=(r:string)=> r==='owner'? Crown : r==='staff'? Shield : UserCheck;
  if(loading) return <View style={[s.center,{backgroundColor:colors.background}]}><ActivityIndicator color={colors.primary}/></View>;
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <UsersRound size={18} color={colors.primary}/><Text style={[s.title,{color:colors.foreground}]}>Roles</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:12,gap:8}}>
        <Text style={{fontSize:12,color:colors.mutedForeground,textAlign:'center'}}>Tap role to cycle: owner → staff → farmer</Text>
        {users.slice(0,50).map((u:any)=>{
          const role=u.role||'owner';
          const Icon=iconFor(role);
          const next = role==='owner'?'staff': role==='staff'?'farmer':'owner';
          return (
            <View key={u._id} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
              <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><Icon size={16} color={colors.primary}/></View>
              <View style={{flex:1}}>
                <Text style={[s.name,{color:colors.foreground}]}>{u.name||u.phone}</Text>
                <Text style={{fontSize:11,color:colors.mutedForeground}}>{u.phone} {u.email? `· ${u.email}`:''}</Text>
              </View>
              <Pressable onPress={()=>changeRole(u._id,next)} style={[s.roleBtn,{backgroundColor: role==='owner'? colors.primary: colors.card, borderColor: role==='owner'? colors.primary: colors.border}]}>
                <Text style={{color: role==='owner'? '#fff': colors.foreground, fontWeight:'700', fontSize:12}}>{role}</Text>
              </Pressable>
            </View>
          );
        })}
        {users.length===0 && <Text style={{color:colors.mutedForeground,textAlign:'center',marginTop:20}}>No users found</Text>}
      </ScrollView>
    </View>
  );
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  card:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:12,padding:10},
  iconBox:{width:34,height:34,borderRadius:8,alignItems:'center',justifyContent:'center'}, name:{fontSize:13,fontWeight:'600'}, roleBtn:{borderWidth:1,borderRadius:8,paddingHorizontal:10,paddingVertical:6}
});
