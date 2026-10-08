import {createApp,h} from 'vue';
import '../host.css';
createApp({render(){return h('main',[h('header',[h('small','ATLED ENGERGY / VUE CUSTOMER PORTAL'),h('h1','客戶能源營運中心'),h('p','使用同一份離線報告，保留客戶入口的品牌與操作脈絡。')]),h('iframe',{title:'ATLED Engergy weekly report',sandbox:'allow-scripts',src:'../../report.html'})]);}}).mount('#app');
