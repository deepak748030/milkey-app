import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useTheme } from '@/hooks/useTheme';
import { ArrowLeft, Plus, Trash2, Edit2, HelpCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { getAuthToken } from '@/lib/authStore';

import { API_BASE_URL as API_BASE } from '@/lib/apiConfig';

export default function AdminFaqs() {
  const { colors } = useTheme();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    try {
      const token = await getAuthToken();
      // try admin/all first, fallback to public
      let res = await global.fetch(`${API_BASE}/faqs/admin/all`, { headers: { Authorization: `Bearer ${token}` } });
      let d = await res.json();
      if (!d.success) {
        const r2 = await global.fetch(`${API_BASE}/faqs`);
        d = await r2.json();
      }
      if (d.success) setFaqs(d.response || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(()=>{ fetch(); },[]);

  const handleSave = async () => {
    if(!question.trim()||!answer.trim()){ Alert.alert('Error','Question and answer required'); return; }
    setSaving(true);
    try{
      const token = await getAuthToken();
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${API_BASE}/faqs/${editing._id}` : `${API_BASE}/faqs`;
      const res = await global.fetch(url,{ method, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ question, answer }) });
      const d = await res.json();
      if(d.success){ setQuestion(''); setAnswer(''); setShowForm(false); setEditing(null); fetch(); }
      else Alert.alert('Error', d.message||'Failed');
    }catch{ Alert.alert('Error','Failed'); } finally{ setSaving(false); }
  };

  const handleDelete = (id:string)=>{
    Alert.alert('Delete','Delete this FAQ?',[{text:'Cancel'},{text:'Delete',style:'destructive', onPress: async()=>{
      const token = await getAuthToken();
      const res = await global.fetch(`${API_BASE}/faqs/${id}`,{ method:'DELETE', headers:{ Authorization:`Bearer ${token}` }});
      const d = await res.json();
      if(d.success) fetch(); else Alert.alert('Error',d.message);
    }}]);
  };

  const styles = createStyles(colors);
  if(loading) return <View style={[styles.center,{backgroundColor:colors.background}]}><ActivityIndicator color={colors.primary}/></View>;

  return (
    <View style={[styles.container,{backgroundColor:colors.background}]}>
      <View style={[styles.header,{backgroundColor:colors.card, borderBottomColor:colors.border}]}>
        <Pressable onPress={()=>router.back()} style={styles.backBtn}><ArrowLeft size={20} color={colors.foreground}/></Pressable>
        <HelpCircle size={18} color={colors.primary}/><Text style={[styles.headerTitle,{color:colors.foreground}]}>Manage FAQs</Text>
        <View style={{flex:1}}/>
        <Pressable onPress={()=>{ setEditing(null); setQuestion(''); setAnswer(''); setShowForm(!showForm); }} style={[styles.addBtn,{backgroundColor:colors.primary}]}>
          <Plus size={16} color="#fff"/><Text style={styles.addText}>{showForm?'Close':'Add'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={[styles.formCard,{backgroundColor:colors.card, borderColor:colors.border}]}>
          <Text style={[styles.label,{color:colors.foreground}]}>Question</Text>
          <TextInput value={question} onChangeText={setQuestion} placeholder="Enter question" placeholderTextColor={colors.mutedForeground} style={[styles.input,{borderColor:colors.border,color:colors.foreground,backgroundColor:colors.background}]} />
          <Text style={[styles.label,{color:colors.foreground}]}>Answer</Text>
          <TextInput value={answer} onChangeText={setAnswer} placeholder="Enter answer" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={4} style={[styles.input,{borderColor:colors.border,color:colors.foreground,backgroundColor:colors.background, height:90, textAlignVertical:'top'}]} />
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn,{backgroundColor:colors.primary}]}>{saving?<ActivityIndicator color="#fff"/>:<Text style={styles.saveText}>{editing?'Update':'Create'}</Text>}</Pressable>
        </View>
      )}

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:12, paddingBottom:40}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true); fetch();}}/>}>
        {faqs.length===0? <View style={styles.empty}><Text style={{color:colors.mutedForeground}}>No FAQs. Add one above.</Text></View> :
          faqs.map((f)=>(
            <View key={f._id} style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}>
              <Text style={[styles.q,{color:colors.foreground}]}>{f.question}</Text>
              <Text style={[styles.a,{color:colors.mutedForeground}]} numberOfLines={3}>{f.answer}</Text>
              <View style={styles.actions}>
                <Pressable onPress={()=>{ setEditing(f); setQuestion(f.question); setAnswer(f.answer); setShowForm(true); }} style={[styles.iconBtn,{borderColor:colors.border}]}><Edit2 size={14} color={colors.primary}/><Text style={{color:colors.primary,fontSize:12}}>Edit</Text></Pressable>
                <Pressable onPress={()=>handleDelete(f._id)} style={[styles.iconBtn,{borderColor:colors.destructive}]}><Trash2 size={14} color={colors.destructive}/><Text style={{color:colors.destructive,fontSize:12}}>Delete</Text></Pressable>
              </View>
            </View>
          ))
        }
      </ScrollView>
    </View>
  );
}

const createStyles=(c:any)=>StyleSheet.create({
  container:{ flex:1 }, center:{ flex:1, alignItems:'center', justifyContent:'center' },
  header:{ flexDirection:'row', alignItems:'center', gap:8, paddingTop:44, paddingHorizontal:12, paddingBottom:10, borderBottomWidth:1 },
  backBtn:{ width:36, height:36, alignItems:'center', justifyContent:'center' }, headerTitle:{ fontSize:16, fontWeight:'700', marginLeft:2},
  addBtn:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:8 }, addText:{ color:'#fff', fontWeight:'700', fontSize:13 },
  formCard:{ margin:12, borderWidth:1, borderRadius:12, padding:12, gap:8 }, label:{ fontSize:12, fontWeight:'600' }, input:{ borderWidth:1, borderRadius:8, paddingHorizontal:10, paddingVertical:8, fontSize:13 },
  saveBtn:{ marginTop:6, height:40, borderRadius:8, alignItems:'center', justifyContent:'center'}, saveText:{ color:'#fff', fontWeight:'700' },
  empty:{ alignItems:'center', marginTop:30 }, card:{ borderWidth:1, borderRadius:10, padding:12, marginBottom:8 }, q:{ fontWeight:'600', fontSize:13, marginBottom:4 }, a:{ fontSize:12, lineHeight:16 }, actions:{ flexDirection:'row', gap:8, marginTop:8 }, iconBtn:{ flexDirection:'row', alignItems:'center', gap:4, borderWidth:1, borderRadius:8, paddingHorizontal:10, paddingVertical:6 }
});
