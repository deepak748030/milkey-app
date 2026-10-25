import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Plus, Trash2, Edit2, Tag } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuthToken } from '@/lib/authStore';
import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';
export default function AdminCategories(){
  const {colors}=useTheme();
  const [cats,setCats]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<any>(null);
  const [name,setName]=useState('');
  const [saving,setSaving]=useState(false);
  const fetchData=async()=>{
    try{
      const token=await getAuthToken();
      let r=await fetch(`${API_BASE}/categories/admin/all`,{headers:{Authorization:`Bearer ${token}`}});
      let d=await r.json();
      if(!d.success){ r=await fetch(`${API_BASE}/categories`,{headers:{Authorization:`Bearer ${token}`}}); d=await r.json(); }
      if(d.success) setCats(d.response||[]);
    }catch{} finally{ setLoading(false); setRefreshing(false); }
  };
  useEffect(()=>{fetchData();},[]);
  const handleSave=async()=>{
    if(!name.trim()){Alert.alert('Error','Name required'); return;}
    setSaving(true);
    try{
      const token=await getAuthToken();
      const method=editing?'PUT':'POST';
      const url=editing?`${API_BASE}/categories/${editing._id}`:`${API_BASE}/categories`;
      const r=await fetch(url,{method, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({name})});
      const d=await r.json();
      if(d.success){ setName(''); setShowForm(false); setEditing(null); fetchData(); } else Alert.alert('Error', d.message||'Failed');
    }catch{} finally{ setSaving(false); }
  };
  const handleDelete=(id:string)=>{
    Alert.alert('Delete','Delete category?',[{text:'Cancel'},{text:'Delete',style:'destructive', onPress: async()=>{
      const token=await getAuthToken(); const r=await fetch(`${API_BASE}/categories/${id}`,{method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); const d=await r.json(); if(d.success) fetchData(); else Alert.alert('Error',d.message);
    }}]);
  };
  const s=createStyles(colors);
  if(loading) return <View style={[s.center,{backgroundColor:colors.background}]}><ActivityIndicator color={colors.primary}/></View>;
  return (
    <View style={[s.container,{backgroundColor:colors.background}]}>
      <View style={[s.header,{backgroundColor:colors.card,borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <Tag size={18} color={colors.primary}/><Text style={[s.title,{color:colors.foreground}]}>Manage Categories</Text>
        <View style={{flex:1}}/>
        <Pressable onPress={()=>{setEditing(null); setName(''); setShowForm(!showForm);}} style={[s.addBtn,{backgroundColor:colors.primary}]}><Plus size={16} color="#fff"/><Text style={s.addText}>{showForm?'Close':'Add'}</Text></Pressable>
      </View>
      {showForm && (
        <View style={[s.form,{backgroundColor:colors.card,borderColor:colors.border}]}>
          <TextItem label="Category Name" value={name} onChange={setName} colors={colors} placeholder="e.g. Milk, Curd"/>
          <Pressable onPress={handleSave} disabled={saving} style={[s.save,{backgroundColor:colors.primary}]}>{saving? <ActivityIndicator color="#fff"/>:<Text style={s.saveText}>{editing?'Update':'Create'}</Text>}</Pressable>
        </View>
      )}
      <ScrollView contentContainerStyle={{padding:12,gap:8,paddingBottom:30}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetchData();}}/>}>
        {cats.length===0? <Text style={{color:colors.mutedForeground,textAlign:'center',marginTop:20}}>No categories. Add one.</Text>:
          cats.map((c:any)=>(
            <View key={c._id} style={[s.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
              <View style={[s.iconBox,{backgroundColor:colors.primary+'18'}]}><Tag size={16} color={colors.primary}/></View>
              <View style={{flex:1}}><Text style={[s.name,{color:colors.foreground}]}>{c.name}</Text><Text style={{color:colors.mutedForeground,fontSize:11}}>{c.slug||''}</Text></View>
              <Pressable onPress={()=>{setEditing(c); setName(c.name); setShowForm(true);}} style={[s.ibtn,{borderColor:colors.border}]}><Edit2 size={14} color={colors.primary}/></Pressable>
              <Pressable onPress={()=>handleDelete(c._id)} style={[s.ibtn,{borderColor:colors.destructive}]}><Trash2 size={14} color={colors.destructive}/></Pressable>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
}
function TextItem({label,value,onChange,colors,placeholder}:{label:string,value:string,onChange:(v:string)=>void,colors:any,placeholder:string}){
  return (<><Text style={{fontSize:12,fontWeight:'600',color:colors.foreground}}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={{borderWidth:1,borderColor:colors.border,borderRadius:8,padding:10,color:colors.foreground,backgroundColor:colors.background}}/></>);
}
const createStyles=(c:any)=>StyleSheet.create({
  container:{flex:1}, center:{flex:1,alignItems:'center',justifyContent:'center'},
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingTop:44,paddingHorizontal:12,paddingBottom:10,borderBottomWidth:1},
  backBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'}, title:{fontSize:16,fontWeight:'700',marginLeft:2},
  addBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:8}, addText:{color:'#fff',fontWeight:'700',fontSize:13},
  form:{margin:12,borderWidth:1,borderRadius:12,padding:12,gap:8}, save:{height:40,borderRadius:8,alignItems:'center',justifyContent:'center',marginTop:4}, saveText:{color:'#fff',fontWeight:'700'},
  card:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:12,padding:12}, iconBox:{width:36,height:36,borderRadius:10,alignItems:'center',justifyContent:'center'}, name:{fontSize:13,fontWeight:'600'}, ibtn:{width:32,height:32,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:c.background},
});
