from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
MOCK = r'''
(() => {
  localStorage.setItem('prompt-hub-updater', JSON.stringify({state:{enabled:false,optInDecided:true},version:0}));
  let library = {
    groups: [{id:'g1',name:'开发工具',orderIndex:0},{id:'g2',name:'研究资料',orderIndex:1}],
    websites: [
      {id:'w1',name:'API 参考',url:'https://example.com/api',description:'常用接口文档',groupId:'g1',orderIndex:0,createdAt:'2026-09-23T00:00:00Z',deletedAt:null},
      {id:'w2',name:'组件目录',url:'https://example.org/components',description:'评估成熟组件',groupId:'g1',orderIndex:1,createdAt:'2026-09-23T00:00:00Z',deletedAt:null},
      {id:'w3',name:'论文检索',url:'https://research.example.net',description:'查资料与原始论文',groupId:'g2',orderIndex:0,createdAt:'2026-09-23T00:00:00Z',deletedAt:null}
    ]
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 1,
    unregisterCallback: () => {},
    invoke: async (cmd, args) => {
      if (cmd === 'list_websites') return structuredClone(library);
      if (cmd === 'save_website') {
        const v = args.input;
        if (v.id) Object.assign(library.websites.find(w=>w.id===v.id),v);
        else library.websites.push({...v,id:'w'+(library.websites.length+1),orderIndex:library.websites.length,createdAt:new Date().toISOString(),deletedAt:null});
        return;
      }
      if (cmd === 'delete_website') { library.websites.find(w=>w.id===args.id).deletedAt=new Date().toISOString(); return; }
      if (cmd === 'restore_website') { library.websites.find(w=>w.id===args.id).deletedAt=null; return; }
      if (cmd === 'open_website') { window.__openedSiteId=args.id; return; }
      if (cmd === 'count_today_usage' || cmd === 'count_pending_drafts') return 0;
      if (cmd === 'load_global_hotkey' || cmd === 'get_global_hotkey') return 'Alt+Space';
      if (cmd === 'list_trash') return [];
      return [];
    }
  };
})();
'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True)
    page = browser.new_page(viewport={'width': 1180, 'height': 760}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script(script=MOCK)
    page.goto('http://127.0.0.1:4173/', wait_until='networkidle')
    page.get_by_role('button', name='常用网站').click()
    page.get_by_text('API 参考').wait_for()
    page.screenshot(path=str(ROOT/'evidence'/'website-preview.png'), full_page=True)
    page.get_by_role('searchbox', name='搜索网站').fill('原始论文')
    assert page.get_by_text('论文检索').count() == 1
    assert page.get_by_text('API 参考').count() == 0
    page.get_by_role('searchbox', name='搜索网站').fill('')
    page.get_by_role('button', name='添加网站').click()
    page.get_by_label('名称').fill('测试入口')
    page.get_by_label('网址').fill('https://example.edu')
    page.get_by_role('button', name='保存').click()
    page.get_by_text('测试入口').wait_for()
    page.get_by_role('article').filter(has_text='测试入口').get_by_role('button', name='打开').click()
    assert page.evaluate('window.__openedSiteId') == 'w4'
    assert not errors, errors
    print('visual smoke passed: tab, search, add, ID-based open; screenshot saved')
    browser.close()
