import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';
import { X, GraduationCap } from 'lucide-react-native';
const KEY='milkey_tutorial_seen_v1';
export default memo(function TutorialOverlay(){
  const { colors }=useTheme();
  const [visible,setVisible]=useState(false);
  useEffect(()=>{ AsyncStorage.getItem(KEY).then(v=>{ if(!v) setVisible(true); }); },[]);
  const dismiss=async()=>{ await AsyncStorage.setItem(KEY,'1'); setVisible(false); };
  if(!visible) return null;
  const styles=createStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <GraduationCap size={20} color={colors.primary} /><Text style={styles.title}>Welcome to Milkey!</Text>
            <Pressable onPress={dismiss} style={styles.close}><X size={18} color={colors.foreground} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight:300 }}>
            <Text style={styles.step}>1. Add your farmers in Collection → Farmer</Text>
            <Text style={styles.step}>2. Record daily milk in Collection → Purchase</Text>
            <Text style={styles.step}>3. Generate reports in Collection → Report</Text>
            <Text style={styles.step}>4. Manage payments in Collection → Payment</Text>
            <Text style={styles.step}>5. Track advances in Collection → Advance</Text>
            <Text style={styles.step}>6. Selling entries in Selling tab</Text>
          </ScrollView>
          <Pressable onPress={dismiss} style={[styles.btn, { backgroundColor:colors.primary }]}><Text style={styles.btnText}>Get Started</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
});
const createStyles=(c:any)=>StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', padding:20 },
  card:{ backgroundColor:c.card, borderRadius:16, padding:16, borderWidth:1, borderColor:c.border },
  header:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  title:{ flex:1, fontSize:16, fontWeight:'800', color:c.foreground },
  close:{ width:28, height:28, borderRadius:14, backgroundColor:c.muted, alignItems:'center', justifyContent:'center' },
  step:{ fontSize:13, color:c.foreground, marginBottom:8, lineHeight:18 },
  btn:{ marginTop:12, paddingVertical:12, borderRadius:10, alignItems:'center' },
  btnText:{ color:'#fff', fontWeight:'700' },
});
