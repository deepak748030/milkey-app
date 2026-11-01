import React, { useEffect, useState, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/lib/subscriptionStore';
import { AlertTriangle, Crown, Calendar, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';

export default memo(function SubscriptionReminder(){
  const { colors, isDark }=useTheme();
  const { status }=useSubscriptionStore();
  const [daysLeft,setDaysLeft]=useState<number|null>(null);
  const [expiryDate,setExpiryDate]=useState<Date|null>(null);

  useEffect(()=>{
    if(!status) { setDaysLeft(null); setExpiryDate(null); return; }
    let expiry: Date | null = null;
    const anyStatus: any = status;
    if(anyStatus.expiryDate){
      expiry = new Date(anyStatus.expiryDate);
    } else if(anyStatus.expiryDate === undefined && anyStatus.expiresAt){
      expiry = new Date(anyStatus.expiresAt);
    } else if(status.subscriptions && status.subscriptions.length>0){
      let minTs = Infinity;
      let minDate: Date | null = null;
      status.subscriptions.forEach((sub:any)=>{
        const d = sub.endDate ? new Date(sub.endDate) : null;
        if(d && d.getTime() < minTs){
          minTs = d.getTime();
          minDate = d;
        }
      });
      if(minDate) expiry = minDate;
      if(anyStatus.expiryDate) expiry = new Date(anyStatus.expiryDate);
    }
    if(expiry){
      setExpiryDate(expiry);
      const diff = expiry.getTime() - Date.now();
      setDaysLeft(Math.ceil(diff/86400000));
    } else {
      setDaysLeft(null);
      setExpiryDate(null);
    }
  },[status]);

  if(!status) return null;

  const styles=createStyles(colors, isDark);

  // New user: no active subscription → CTA to subscribe
  if(!status.hasAnySubscription){
    return (
      <Pressable onPress={()=>router.push('/subscriptions' as any)} style={[styles.banner, styles.noSubBanner, { backgroundColor: isDark ? '#3a2a12' : '#FFFBEB', borderColor: isDark ? '#a16207' : '#FDE68A'}]}>
        <AlertTriangle size={14} color={isDark ? '#fbbf24' : '#D97706'} />
        <Text style={[styles.text, { color: isDark ? '#fde68a' : '#92400E', flex:1 }]}>No active subscription — Subscribe now</Text>
        <ChevronRight size={14} color={isDark ? '#fbbf24' : '#D97706'} />
      </Pressable>
    );
  }

  // Active but expiry unknown → hide (active h to yahan se chala jaaye)
  if(daysLeft===null){
    return null;
  }

  // Expired
  if(daysLeft<=0){
    return (
      <Pressable onPress={()=>router.push('/subscriptions' as any)} style={[styles.banner, { backgroundColor: isDark ? '#450a0a' : '#FEF2F2', borderColor: isDark ? '#991b1b' : '#FECACA'}]}>
        <AlertTriangle size={14} color={isDark ? '#fca5a5' : '#DC2626'} />
        <Text style={[styles.text, { color: isDark ? '#fecaca' : '#DC2626', flex:1 }]}>Subscription expired! Renew now.</Text>
        <ChevronRight size={14} color={isDark ? '#fca5a5' : '#DC2626'} />
      </Pressable>
    );
  }

  // Expiring within 3 days → show amber
  if(daysLeft<=3){
    const dateStr = expiryDate ? expiryDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';
    return (
      <Pressable onPress={()=>router.push('/subscriptions' as any)} style={[styles.banner, { backgroundColor: isDark ? '#3a2a12' : '#FFFBEB', borderColor: isDark ? '#a16207' : '#FDE68A'}]}>
        <AlertTriangle size={14} color={isDark ? '#fbbf24' : '#D97706'} />
        <Text style={[styles.text, { color: isDark ? '#fde68a' : '#92400E', flex:1 }]} numberOfLines={1}>
          {`Subscription expires in ${daysLeft} day${daysLeft>1?'s':''}${dateStr?` • ${dateStr}`:''} — Renew soon`}
        </Text>
        <ChevronRight size={14} color={isDark ? '#fbbf24' : '#D97706'} />
      </Pressable>
    );
  }

  // Active with >3 days left → hide
  return null;
});
const createStyles=(c:any,isDark:boolean)=>StyleSheet.create({
  banner:{ flexDirection:'row', alignItems:'center', gap:6, marginTop:8, marginHorizontal:6, paddingVertical:9, paddingHorizontal:12, borderRadius:10, borderWidth:1 },
  text:{ fontSize:12, fontWeight:'600' },
  noSubBanner:{},
});
