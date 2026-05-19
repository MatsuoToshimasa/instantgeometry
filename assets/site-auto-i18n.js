(function () {
  'use strict';

  const dictionaries = {
    en: {
      'トップ': 'Home',
      'トップへ戻る': 'Back to Home',
      '図形を描く': 'Draw Shapes',
      '図形を描くへ': 'Go to Draw Shapes',
      'このサイトについて': 'About This Site',
      'ログイン': 'Log In',
      'ログインへ戻る': 'Back to Login',
      'ログインする': 'Log In',
      'ログイン処理中': 'Signing In',
      'Googleログインの結果を確認しています。': 'Checking the Google sign-in result.',
      'Googleでログイン': 'Log in with Google',
      'Googleへ移動しています...': 'Opening Google...',
      '支援プランの利用状況や、今後のアカウント機能のために使用します。': 'Used to check your Supporter Plan status and future account features.',
      'ログイン中(支援プラン)': 'Signed in (Supporter Plan)',
      'ログインが完了しませんでした。もう一度お試しください。': 'Sign-in did not complete. Please try again.',
      'すでにログインしています。移動します。': 'You are already signed in. Redirecting.',
      'Googleログインを開始できませんでした。': 'Could not start Google sign-in.',
      'ログイン状態': 'Sign-in Status',
      'ログイン中': 'Signed in',
      'メールアドレス': 'Email Address',
      'ログイン方法': 'Sign-in Method',
      '支援プランを見る': 'View Supporter Plan',
      'ログアウト': 'Log Out',
      'ログアウトしています...': 'Signing out...',
      'ログアウトしました。': 'Signed out.',
      'ログアウトに失敗しました。': 'Could not sign out.',
      'アカウント': 'Account',
      'アカウント情報': 'Account Information',
      '利用プラン': 'Plan',
      '現在のプラン': 'Current Plan',
      '説明': 'Description',
      '確認中...': 'Checking...',
      '読み込み中です。': 'Loading.',
      '無料プラン': 'Free Plan',
      '支援プラン': 'Supporter Plan',
      'InstantGeometry 支援プラン': 'InstantGeometry Supporter Plan',
      'ログイン状態、メールアドレス、支援プランの利用状況を確認できます。': 'Check your sign-in status, email address, and Supporter Plan status.',
      'Googleアカウントでログインすると、アカウント情報や支援プランの状態を確認できます。': 'Log in with your Google account to check your account information and Supporter Plan status.',
      '支援プランでは、保存回数やPDF出力回数の制限なく使えるようになります。': 'With the Supporter Plan, you can use saving and PDF export without limits.',
      '現在は無料プランです。': 'You are currently on the free plan.',
      '現在、支援プランが有効です。': 'Your Supporter Plan is active.',
      'ログイン後に支援プランの状態を確認できます。': 'Sign in to check your Supporter Plan status.',
      '支援プランを管理・解約': 'Manage or cancel Supporter Plan',
      '支援プラン管理ページを開いています...': 'Opening the Supporter Plan management page...',
      '支援プラン管理ページを作成できませんでした。': 'Could not create the Supporter Plan management page.',
      'ログイン状態を確認できませんでした。': 'Could not check sign-in status.',
      '読み込みに失敗しました。': 'Loading failed.',
      '不明': 'Unknown',
      '準備中': 'Coming Soon',
      'COMING SOON': 'COMING SOON',
      'この機能は準備中です': 'This feature is coming soon',
      '現在、UIと内部ロジックを整備しています。公開までしばらくお待ちください。': 'The interface and internal logic are being prepared. Please wait for release.',
      '問題を作る は準備中です': 'Create Problems is coming soon',
      '問題生成の仕様と出力品質を調整中です。整い次第公開します。': 'Problem generation specs and output quality are being tuned. It will be released when ready.',
      '関数を描く は準備中です': 'Graph Functions is coming soon',
      '関数グラフ機能は現在準備中です。先に図形描画をご利用ください。': 'Function graphing is being prepared. Please use shape drawing for now.',
      '問題ジェネレーターは準備中です': 'The problem generator is coming soon',
      'このURLは現在公開前です。公開までお待ちください。': 'This URL is not public yet. Please wait for release.',
      '関数を描く': 'Graph Functions',
      '一次関数': 'Linear Function',
      '二次関数': 'Quadratic Function',
      '三角関数': 'Trigonometric Functions',
      '新規登録': 'Sign Up',
      'メールアドレス': 'Email Address',
      'パスワード': 'Password',
      '登録': 'Sign Up',
      '登録成功': 'Sign-up complete',
      '支援プラン': 'Supporter Plan',
      '支援プランに参加する': 'Join Supporter Plan',
      '戻る': 'Back',
      'InstantGeometry は、できるだけ無料で使える教育ツールとして運営しています。 サーバー費用や機能改善を継続するため、支援プランへの参加をお願いしています。': 'InstantGeometry is operated as an educational tool that stays as free as possible. To keep covering server costs and ongoing improvements, please consider joining the Supporter Plan.',
      '保存・PDF出力の制限なく利用できます': 'Use saving and PDF export without limits',
      '今後の追加機能も利用しやすくなります': 'Get easier access to future features',
      '教育ツールとしての継続運営を支えられます': 'Support continued operation as an educational tool',
      '支援プラン: 無制限で保存できます。': 'Supporter Plan: you can save without limits.',
      '未ログインは1日3回、無料ログインは1日6回までです。支援プランで無制限にできます。': 'Guests can save 3 times per day, and free signed-in users can save 6 times per day. The Supporter Plan removes this limit.',
      '現在はボタンの見た目のみです。次にStripeと接続します。': 'This button is visual only for now. Stripe integration comes next.',
      '料金の取得に失敗しました': 'Could not load pricing',
      '決済ページの作成に失敗しました': 'Could not create checkout page',
      '月額 ': 'Monthly ',
      '円': ' JPY',
      '保存': 'Save',
      '設定': 'Settings',
      '閉じる': 'Close',
      '透過PNG': 'Transparent PNG',
      '透過': 'Transparent',
      'キャンセル': 'Cancel',
      '通常': 'Plain',
      '丸付き': 'Circle mark',
      '一本線付き': 'Single tick',
      '二重線付き': 'Double tick',
      '交差付き': 'Cross mark',
      '三角付き': 'Triangle mark',
      '二重交差線付き': 'Double cross mark',
      '直角記号付き': 'Right angle mark',
      '角弧なし': 'Hide angle arc',
      'ラベル': 'Label',
      '面積': 'Area',
      '多角形': 'Polygon',
      '点 ': 'Point ',
      '弧 AB': 'Arc AB',
      '角 AOB': 'Angle AOB',
      '角 ACB': 'Angle ACB',
      '辺 a（BC）': 'Side a (BC)',
      '辺 b（CA）': 'Side b (CA)',
      '辺 c（AB）': 'Side c (AB)',
      '角 A（∠BAC）': 'Angle A (∠BAC)',
      '角 B（∠ABC）': 'Angle B (∠ABC)',
      '角 C（∠BCA）': 'Angle C (∠BCA)',
      '角 A': 'Angle A',
      '角 B': 'Angle B',
      '角 C': 'Angle C',
      '角 D': 'Angle D',
      '角 E': 'Angle E',
      '角 F': 'Angle F',
      '角 G': 'Angle G',
      '角 H': 'Angle H',
      '半径': 'Radius',
      '半径 r': 'Radius r',
      '横半径 a': 'Horizontal radius a',
      '縦半径 b': 'Vertical radius b',
      '中心角': 'Central angle',
      '中心角（度）': 'Central angle (degrees)',
      '幅': 'Width',
      '高さ': 'Height',
      '横': 'Width',
      '縦': 'Height',
      'ずれ': 'Offset',
      '上底': 'Top base',
      '下底': 'Bottom base',
      '角A': 'Angle A',
      '斜辺 b（CA）': 'Hypotenuse b (CA)',
      '隣辺 c（AB）': 'Adjacent side c (AB)',
      '対辺 a（BC）': 'Opposite side a (BC)',
      '前の画面に戻る': 'Back to previous screen',
      '画面': 'View',
      '画面比 1:1': 'Aspect 1:1',
      'リセット': 'Reset',
      '出力': 'Export',
      '単位': 'Units',
      '度数法': 'Degrees',
      '長さcm': 'Length cm',
      '長さm': 'Length m',
      '長さkm': 'Length km',
      '単位なし': 'No units',
      '辺 AB': 'Side AB',
      '辺 BC': 'Side BC',
      '辺 CD': 'Side CD',
      '辺 DE': 'Side DE',
      '辺 EA': 'Side EA',
      '線分 AC': 'Segment AC',
      '線分 AD': 'Segment AD',
      '入力をもとに五角形を描画しています。': 'Drawing the pentagon from the input.',
      '5辺とAC、ADを入力すると、五角形を自動で描画します。': 'Enter five sides, AC, and AD to draw the pentagon automatically.',
      '5つの内角を入力すると、五角形を自動で描画します。': 'Enter five interior angles to draw the pentagon automatically.',
      '五角形（角）': 'Pentagon (Angles)',
      'この角の組み合わせでは五角形を作れません。': 'A pentagon cannot be formed from this angle combination.',
      '整数や小数に加えて、sqrt(3)、π/2、sin(30deg) のような式も入力できます。': 'You can enter integers, decimals, or expressions such as sqrt(3), pi/2, or sin(30deg).',
      '0より大きい値を入力してください。': 'Enter a value greater than 0.',
      '式を読み取れませんでした。': 'The expression could not be read.',
      'この条件では五角形を作れません。5辺・AC・AD を見直してください。': 'A pentagon cannot be formed with these conditions. Check the 5 sides, AC, and AD.',
      '一般ラベル': 'General Labels',
      '特別ラベル': 'Special Labels',
      '特別点ラベル': 'Special Point Labels',
      '対角線ラベル': 'Diagonal Labels',
      '特別角ラベル': 'Special Angle Labels',
      '形を決める値': 'Shape Values',
      '辺 EF': 'Side EF',
      '辺 FA': 'Side FA',
      '辺 FG': 'Side FG',
      '辺 GA': 'Side GA',
      '辺 GH': 'Side GH',
      '辺 HA': 'Side HA',
      '線分 AE': 'Segment AE',
      '星型': 'Star',
      '五角形': 'Pentagon',
      '六角形': 'Hexagon',
      '正N角形': 'Regular N-gon',
      '三角形': 'Triangle',
      '四角形': 'Quadrilateral',
      '正方形': 'Square',
      '長方形': 'Rectangle',
      '菱形': 'Rhombus',
      '菱形（一辺＋角）': 'Rhombus (Side + Angle)',
      '台形': 'Trapezoid',
      '等脚台形': 'Isosceles Trapezoid',
      '平行四辺形': 'Parallelogram',
      '凧形': 'Kite',
      '凸四角形': 'Convex Quadrilateral',
      '凹四角形': 'Concave Quadrilateral',
      '四角形と外接円': 'Cyclic Quadrilateral',
      '四角形と外接円の描画画面': 'Cyclic quadrilateral drawing area',
      '角Aと角Bを入力すると、同一円周上の四角形を自動で描画します。': 'Enter angles A and B to draw a quadrilateral whose vertices lie on one circle.',
      '入力をもとに四角形と外接円を描画しています。': 'Drawing the cyclic quadrilateral and circumcircle from the input.',
      '角Aと角Bから外接円をもつ四角形を描画します。': 'Draw a cyclic quadrilateral with a circumcircle from angles A and B.',
      'この角の組み合わせでは四角形を作れません。': 'A quadrilateral cannot be formed from this angle combination.',
      '円': 'Circle',
      '楕円': 'Ellipse',
      '扇形': 'Sector',
      '楕円の扇形': 'Elliptic Sector',
      '円周角と中心角': 'Inscribed Angle and Central Angle',
      '円周角 ACB（度）': 'Inscribed angle ACB (degrees)',
      '円周角 ACB を入力すると、中心角 AOB を自動で描画します。': 'Enter inscribed angle ACB to draw central angle AOB automatically.',
      '入力をもとに円周角と中心角を描画しています。': 'Drawing the inscribed angle and central angle from the input.',
      '円周角には整数を入力してください。': 'Enter an integer for the inscribed angle.',
      '円周角は 0° 以上 180° 以下の整数にしてください。': 'Enter an integer from 0 to 180 for the inscribed angle.',
      '３辺': '3 Sides',
      '３角': '3 Angles',
      '２辺夹角': '2 Sides and Included Angle',
      '１辺両角': '1 Side and Two Angles',
      '二等辺三角形': 'Isosceles Triangle',
      '正三角形': 'Equilateral Triangle',
      '二等辺三角形（垂線）': 'Isosceles Triangle (Altitude)',
      '正三角形（垂線）': 'Equilateral Triangle (Altitude)',
      '外心': 'Circumcenter',
      '内心': 'Incenter',
      '重心': 'Centroid',
      '垂心': 'Orthocenter',
      '直角（鋭角）': 'Right Triangle (acute angle)',
      '直角（隣辺）': 'Right Triangle (adjacent side)',
      '直角（対辺）': 'Right Triangle (opposite side)',
      '3点座標': '3 Point Coordinates',
      '底辺＋高さ': 'Base + Height',
      '入力をもとに三角形を描画しています。': 'Drawing the triangle from the input.',
      '入力をもとに六角形を描画しています。': 'Drawing the hexagon from the input.',
      '6辺とAC、AD、AEを入力すると、六角形を自動で描画します。': 'Enter six sides, AC, AD, and AE to draw the hexagon automatically.',
      '6つの内角を入力すると、六角形を自動で描画します。': 'Enter six interior angles to draw the hexagon automatically.',
      '六角形（角）': 'Hexagon (Angles)',
      'この角の組み合わせでは六角形を作れません。': 'A hexagon cannot be formed from this angle combination.',
      '七角形（角）': 'Heptagon (Angles)',
      '八角形（角）': 'Octagon (Angles)',
      '7つの内角を入力すると、七角形を自動で描画します。': 'Enter seven interior angles to draw the heptagon automatically.',
      '8つの内角を入力すると、八角形を自動で描画します。': 'Enter eight interior angles to draw the octagon automatically.',
      '入力をもとに七角形を描画しています。': 'Drawing the heptagon from the input.',
      '入力をもとに八角形を描画しています。': 'Drawing the octagon from the input.',
      'この角の組み合わせでは七角形を作れません。': 'A heptagon cannot be formed from this angle combination.',
      'この角の組み合わせでは八角形を作れません。': 'An octagon cannot be formed from this angle combination.',
      '七角形（角）の描画画面': 'Heptagon angle drawing area',
      '八角形（角）の描画画面': 'Octagon angle drawing area',
      '7つの内角から七角形を描画します。': 'Draw a heptagon from seven interior angles.',
      '8つの内角から八角形を描画します。': 'Draw an octagon from eight interior angles.',
      '角は 1 より大きく 180 未満で入力してください。': 'Enter each angle greater than 1 and less than 180.',
      '角の和が 540° になるように入力してください。': 'Enter angles so their sum is 540°.',
      '角の和が 720° になるように入力してください。': 'Enter angles so their sum is 720°.',
      '角の和が 900° になるように入力してください。': 'Enter angles so their sum is 900°.',
      '角の和が 1080° になるように入力してください。': 'Enter angles so their sum is 1080°.',
      '六角形を描画しました。': 'Hexagon rendered.',
      'この条件では六角形を作れません。6辺・AC・AD・AE を見直してください。': 'These conditions cannot form a hexagon. Check the 6 sides, AC, AD, and AE.',
      '3辺を入力すると、三角形を自動で描画します。': 'Enter 3 sides to draw the triangle automatically.',
      '3辺から三角形の外心を描画します。': 'Draw the triangle circumcenter from 3 sides.',
      '3辺から三角形の内心を描画します。': 'Draw the triangle incenter from 3 sides.',
      '3辺から三角形の重心を描画します。': 'Draw the triangle centroid from 3 sides.',
      '3辺から三角形の垂心を描画します。': 'Draw the triangle orthocenter from 3 sides.',
      '入力をもとに外心を描画しています。': 'Drawing the circumcenter from the input.',
      '入力をもとに内心を描画しています。': 'Drawing the incenter from the input.',
      '入力をもとに重心を描画しています。': 'Drawing the centroid from the input.',
      '入力をもとに垂心を描画しています。': 'Drawing the orthocenter from the input.',
      '２辺とその間の角を入力すると、三角形を自動で描画します。': 'Enter two sides and the included angle to draw the triangle automatically.',
      '１辺と両端の角を入力すると、三角形を自動で描画します。': 'Enter one side and its two endpoint angles to draw the triangle automatically.',
      '角 A + 角 B + 角 C が 180 になるように入力してください。': 'Enter angles so A + B + C equals 180.',
      '入力条件が三角形の条件を満たしていません。': 'The input conditions do not form a triangle.',
      '角 A には 1 以上 179 以下の整数を入力してください。': 'Enter an integer from 1 to 179 for angle A.',
      '角 B と角 C は正で、和が 180 未満である必要があります。': 'Angles B and C must be positive and sum to less than 180.',
      '角 A、角 B、角 C には正の整数を入力してください。': 'Enter positive integers for angles A, B, and C.',
      '角 A + 角 B + 角 C が 180 になるように入力してください。': 'Enter angles so A + B + C equals 180.',
      '角 A と角 B は正で、和が 180 未満である必要があります。': 'Angles A and B must be positive and sum to less than 180.',
      ' には自然数のみ入力できます。': ' only accepts natural numbers.',
      'AI 自動モザイク': 'AI Auto Mosaic',
      '複数画像を自動検出して一括モザイク化': 'Automatically detect and mosaic multiple images',
      '処理の流れ': 'Workflow',
      '画像を複数選択': 'Select multiple images',
      'AI で範囲を自動検出': 'Detect regions with AI',
      'キャンバスで結果を確認': 'Check results on the canvas',
      'PNG または ZIP で保存': 'Save as PNG or ZIP',
      '画像をまとめて選択': 'Select images',
      'JPG / PNG / WebP を複数選択': 'Select multiple JPG / PNG / WebP files',
      '処理設定': 'Processing Settings',
      'モザイクの粗さ': 'Mosaic Block Size',
      '検出範囲の余白': 'Detection Padding',
      'AIで一括処理': 'Process with AI',
      'まだ画像が選択されていません。': 'No images selected yet.',
      '選択画像を保存': 'Save Selected Image',
      'ZIPで保存': 'Save as ZIP',
      '処理キュー': 'Processing Queue',
      'プレビュー': 'Preview',
      '画像を選択するとここに結果が表示されます。': 'Results appear here after selecting images.',
      '待機中': 'Idle',
      '複数画像を読み込んで AI 処理を開始してください。': 'Load multiple images and start AI processing.',
      '検出数': 'Detections',
      '状態': 'Status',
      '未選択': 'Not selected',
      '出力形式': 'Output Format'
    },
    zh: {
      'トップ': '首页',
      'トップへ戻る': '返回首页',
      '図形を描く': '绘制图形',
      '図形を描くへ': '前往绘制图形',
      'このサイトについて': '关于本站',
      'ログイン': '登录',
      'ログインへ戻る': '返回登录',
      'ログインする': '登录',
      'ログイン処理中': '正在登录',
      'Googleログインの結果を確認しています。': '正在确认 Google 登录结果。',
      'Googleでログイン': '使用 Google 登录',
      'Googleへ移動しています...': '正在打开 Google...',
      '支援プランの利用状況や、今後のアカウント機能のために使用します。': '用于确认支持计划使用状态以及今后的账户功能。',
      'ログイン中(支援プラン)': '已登录（支持计划）',
      'ログイン状態': '登录状态',
      'ログイン中': '已登录',
      'メールアドレス': '邮箱地址',
      'ログイン方法': '登录方式',
      '支援プランを見る': '查看支持计划',
      'ログアウト': '退出登录',
      'アカウント': '账户',
      'アカウント情報': '账户信息',
      '利用プラン': '套餐',
      '現在のプラン': '当前套餐',
      '説明': '说明',
      '確認中...': '确认中...',
      '読み込み中です。': '正在读取。',
      '無料プラン': '免费套餐',
      '支援プラン': '支持计划',
      'InstantGeometry 支援プラン': 'InstantGeometry 支持计划',
      '現在、支援プランが有効です。': '当前支持计划已生效。',
      'ログイン後に支援プランの状態を確認できます。': '登录后可以确认支持计划状态。',
      '支援プランを管理・解約': '管理或取消支持计划',
      '支援プラン管理ページを開いています...': '正在打开支持计划管理页面...',
      '支援プラン管理ページを作成できませんでした。': '无法创建支持计划管理页面。',
      '準備中': '准备中',
      'この機能は準備中です': '此功能正在准备中',
      '現在、UIと内部ロジックを整備しています。公開までしばらくお待ちください。': '界面和内部逻辑正在整理，请等待发布。',
      '問題を作る は準備中です': '生成题目正在准备中',
      '関数を描く は準備中です': '绘制函数正在准备中',
      '関数を描く': '绘制函数',
      '一次関数': '一次函数',
      '二次関数': '二次函数',
      '三角関数': '三角函数',
      '新規登録': '注册',
      'パスワード': '密码',
      '登録': '注册',
      '支援プランに参加する': '加入支持计划',
      '戻る': '返回',
      '保存': '保存',
      '設定': '设置',
      '閉じる': '关闭',
      '透過PNG': '透明 PNG',
      'キャンセル': '取消',
      'ラベル': '标签',
      '面積': '面积',
      '半径': '半径',
      '幅': '宽',
      '高さ': '高',
      '横': '宽',
      '縦': '高',
      'ずれ': '偏移',
      '角A': '角 A',
      '角 A': '角 A',
      '角 B': '角 B',
      '角 C': '角 C',
      '角 D': '角 D',
      '角 E': '角 E',
      '角 F': '角 F',
      '角 G': '角 G',
      '角 H': '角 H',
      '前の画面に戻る': '返回上一页',
      '画面': '视图',
      '画面比 1:1': '比例 1:1',
      'リセット': '重置',
      '出力': '导出',
      '単位': '单位',
      '度数法': '角度制',
      '長さcm': '长度 cm',
      '一般ラベル': '通用标签',
      '特別ラベル': '特殊标签',
      '形を決める値': '图形参数',
      '星型': '星形',
      '五角形': '五边形',
      '五角形（角）': '五边形（角）',
      '六角形': '六边形',
      '六角形（角）': '六边形（角）',
      '七角形（角）': '七边形（角）',
      '八角形（角）': '八边形（角）',
      '7つの内角を入力すると、七角形を自動で描画します。': '输入七个内角即可自动绘制七边形。',
      '8つの内角を入力すると、八角形を自動で描画します。': '输入八个内角即可自动绘制八边形。',
      '入力をもとに七角形を描画しています。': '正在根据输入绘制七边形。',
      '入力をもとに八角形を描画しています。': '正在根据输入绘制八边形。',
      'この角の組み合わせでは七角形を作れません。': '无法用这组角形成七边形。',
      'この角の組み合わせでは八角形を作れません。': '无法用这组角形成八边形。',
      '七角形（角）の描画画面': '七边形（角）绘图区域',
      '八角形（角）の描画画面': '八边形（角）绘图区域',
      '7つの内角から七角形を描画します。': '根据七个内角绘制七边形。',
      '8つの内角から八角形を描画します。': '根据八个内角绘制八边形。',
      '角の和が 900° になるように入力してください。': '请输入角度，使总和为 900°。',
      '角の和が 1080° になるように入力してください。': '请输入角度，使总和为 1080°。',
      '正N角形': '正 N 边形',
      '三角形': '三角形',
      '四角形': '四边形',
      '正方形': '正方形',
      '長方形': '长方形',
      '菱形': '菱形',
      '菱形（一辺＋角）': '菱形（一边+角）',
      '台形': '梯形',
      '等脚台形': '等腰梯形',
      '平行四辺形': '平行四边形',
      '凧形': '筝形',
      '凸四角形': '凸四边形',
      '凹四角形': '凹四边形',
      '四角形と外接円': '圆内接四边形',
      '四角形と外接円の描画画面': '圆内接四边形绘图区域',
      '角Aと角Bを入力すると、同一円周上の四角形を自動で描画します。': '输入角 A 和角 B 后自动绘制四点共圆的四边形。',
      '入力をもとに四角形と外接円を描画しています。': '正在根据输入绘制圆内接四边形和外接圆。',
      '角Aと角Bから外接円をもつ四角形を描画します。': '根据角 A 和角 B 绘制带外接圆的四边形。',
      'この角の組み合わせでは四角形を作れません。': '无法根据这组角绘制四边形。',
      '円': '圆',
      '楕円': '椭圆',
      '扇形': '扇形',
      '楕円の扇形': '椭圆扇形',
      '円周角と中心角': '圆周角和圆心角',
      '円周角 ACB（度）': '圆周角 ACB（度）',
      '円周角 ACB を入力すると、中心角 AOB を自動で描画します。': '输入圆周角 ACB 后自动绘制圆心角 AOB。',
      '入力をもとに円周角と中心角を描画しています。': '正在根据输入绘制圆周角和圆心角。',
      '円周角には整数を入力してください。': '请输入圆周角的整数。',
      '円周角は 0° 以上 180° 以下の整数にしてください。': '请输入 0° 到 180° 的整数作为圆周角。',
      '３辺': '三边',
      '３角': '三角',
      '２辺夹角': '两边夹角',
      '１辺両角': '一边两角',
      'AI 自動モザイク': 'AI 自动马赛克',
      '複数画像を自動検出して一括モザイク化': '自动检测多张图片并批量打码',
      '処理の流れ': '处理流程',
      '処理設定': '处理设置',
      '出力形式': '输出格式'
    },
    es: {
      'トップ': 'Inicio',
      'トップへ戻る': 'Volver al inicio',
      '図形を描く': 'Dibujar figuras',
      '図形を描くへ': 'Ir a dibujar figuras',
      'このサイトについて': 'Acerca del sitio',
      'ログイン': 'Iniciar sesión',
      'ログインへ戻る': 'Volver al inicio de sesión',
      'ログインする': 'Iniciar sesión',
      'ログイン処理中': 'Iniciando sesión',
      'Googleログインの結果を確認しています。': 'Comprobando el resultado del inicio de sesión con Google.',
      'Googleでログイン': 'Iniciar sesión con Google',
      'Googleへ移動しています...': 'Abriendo Google...',
      '支援プランの利用状況や、今後のアカウント機能のために使用します。': 'Se usa para comprobar el estado del plan de apoyo y futuras funciones de cuenta.',
      'ログイン中(支援プラン)': 'Con sesión (plan de apoyo)',
      'ログイン状態': 'Estado de sesión',
      'ログイン中': 'Con sesión',
      'メールアドレス': 'Correo electrónico',
      'ログイン方法': 'Método de inicio',
      '支援プランを見る': 'Ver plan de apoyo',
      'ログアウト': 'Cerrar sesión',
      'アカウント': 'Cuenta',
      'アカウント情報': 'Información de cuenta',
      '利用プラン': 'Plan',
      '現在のプラン': 'Plan actual',
      '説明': 'Descripción',
      '確認中...': 'Comprobando...',
      '読み込み中です。': 'Cargando.',
      '無料プラン': 'Plan gratuito',
      '支援プラン': 'Plan de apoyo',
      'InstantGeometry 支援プラン': 'Plan de apoyo de InstantGeometry',
      '現在、支援プランが有効です。': 'Tu plan de apoyo está activo.',
      'ログイン後に支援プランの状態を確認できます。': 'Inicia sesión para comprobar el estado de tu plan de apoyo.',
      '支援プランを管理・解約': 'Gestionar o cancelar el plan de apoyo',
      '支援プラン管理ページを開いています...': 'Abriendo la página de gestión del plan de apoyo...',
      '支援プラン管理ページを作成できませんでした。': 'No se pudo crear la página de gestión del plan de apoyo.',
      '準備中': 'Próximamente',
      'この機能は準備中です': 'Esta función estará disponible pronto',
      '現在、UIと内部ロジックを整備しています。公開までしばらくお待ちください。': 'La interfaz y la lógica interna se están preparando. Espera al lanzamiento.',
      '問題を作る は準備中です': 'Crear problemas estará disponible pronto',
      '関数を描く は準備中です': 'Graficar funciones estará disponible pronto',
      '関数を描く': 'Graficar funciones',
      '一次関数': 'Función lineal',
      '二次関数': 'Función cuadrática',
      '三角関数': 'Funciones trigonométricas',
      '新規登録': 'Registro',
      'パスワード': 'Contraseña',
      '登録': 'Registrarse',
      '支援プランに参加する': 'Unirse al plan de apoyo',
      '戻る': 'Volver',
      '保存': 'Guardar',
      '設定': 'Ajustes',
      '閉じる': 'Cerrar',
      '透過PNG': 'PNG transparente',
      'キャンセル': 'Cancelar',
      'ラベル': 'Etiqueta',
      '面積': 'Área',
      '半径': 'Radio',
      '幅': 'Ancho',
      '高さ': 'Altura',
      '横': 'Ancho',
      '縦': 'Alto',
      'ずれ': 'Desplazamiento',
      '角A': 'Ángulo A',
      '角 A': 'Ángulo A',
      '角 B': 'Ángulo B',
      '角 C': 'Ángulo C',
      '角 D': 'Ángulo D',
      '角 E': 'Ángulo E',
      '角 F': 'Ángulo F',
      '角 G': 'Ángulo G',
      '角 H': 'Ángulo H',
      '前の画面に戻る': 'Volver a la pantalla anterior',
      '画面': 'Vista',
      '画面比 1:1': 'Relación 1:1',
      'リセット': 'Restablecer',
      '出力': 'Exportar',
      '単位': 'Unidades',
      '度数法': 'Grados',
      '長さcm': 'Longitud cm',
      '一般ラベル': 'Etiquetas generales',
      '特別ラベル': 'Etiquetas especiales',
      '形を決める値': 'Valores de la figura',
      '星型': 'Estrella',
      '五角形': 'Pentágono',
      '五角形（角）': 'Pentágono (ángulos)',
      '六角形': 'Hexágono',
      '六角形（角）': 'Hexágono (ángulos)',
      '七角形（角）': 'Heptágono (ángulos)',
      '八角形（角）': 'Octágono (ángulos)',
      '7つの内角を入力すると、七角形を自動で描画します。': 'Introduce siete ángulos interiores para dibujar el heptágono automáticamente.',
      '8つの内角を入力すると、八角形を自動で描画します。': 'Introduce ocho ángulos interiores para dibujar el octágono automáticamente.',
      '入力をもとに七角形を描画しています。': 'Dibujando el heptágono a partir de la entrada.',
      '入力をもとに八角形を描画しています。': 'Dibujando el octágono a partir de la entrada.',
      'この角の組み合わせでは七角形を作れません。': 'No se puede formar un heptágono con esta combinación de ángulos.',
      'この角の組み合わせでは八角形を作れません。': 'No se puede formar un octágono con esta combinación de ángulos.',
      '七角形（角）の描画画面': 'Área de dibujo del heptágono por ángulos',
      '八角形（角）の描画画面': 'Área de dibujo del octágono por ángulos',
      '7つの内角から七角形を描画します。': 'Dibuja un heptágono a partir de siete ángulos interiores.',
      '8つの内角から八角形を描画します。': 'Dibuja un octágono a partir de ocho ángulos interiores.',
      '角の和が 900° になるように入力してください。': 'Introduce ángulos cuya suma sea 900°.',
      '角の和が 1080° になるように入力してください。': 'Introduce ángulos cuya suma sea 1080°.',
      '正N角形': 'N-gono regular',
      '三角形': 'Triángulo',
      '四角形': 'Cuadrilátero',
      '正方形': 'Cuadrado',
      '長方形': 'Rectángulo',
      '菱形': 'Rombo',
      '菱形（一辺＋角）': 'Rombo (lado + ángulo)',
      '台形': 'Trapecio',
      '等脚台形': 'Trapecio isósceles',
      '平行四辺形': 'Paralelogramo',
      '凧形': 'Deltoide',
      '凸四角形': 'Cuadrilátero convexo',
      '凹四角形': 'Cuadrilátero cóncavo',
      '四角形と外接円': 'Cuadrilátero cíclico',
      '四角形と外接円の描画画面': 'Área de dibujo del cuadrilátero cíclico',
      '角Aと角Bを入力すると、同一円周上の四角形を自動で描画します。': 'Introduce los ángulos A y B para dibujar un cuadrilátero cuyos vértices están en una misma circunferencia.',
      '入力をもとに四角形と外接円を描画しています。': 'Dibujando el cuadrilátero cíclico y la circunferencia circunscrita a partir de la entrada.',
      '角Aと角Bから外接円をもつ四角形を描画します。': 'Dibuja un cuadrilátero cíclico con circunferencia circunscrita a partir de los ángulos A y B.',
      'この角の組み合わせでは四角形を作れません。': 'No se puede formar un cuadrilátero con esta combinación de ángulos.',
      '円': 'Círculo',
      '楕円': 'Elipse',
      '扇形': 'Sector',
      '楕円の扇形': 'Sector elíptico',
      '円周角と中心角': 'Ángulo inscrito y ángulo central',
      '円周角 ACB（度）': 'Ángulo inscrito ACB (grados)',
      '円周角 ACB を入力すると、中心角 AOB を自動で描画します。': 'Introduce el ángulo inscrito ACB para dibujar automáticamente el ángulo central AOB.',
      '入力をもとに円周角と中心角を描画しています。': 'Dibujando el ángulo inscrito y el ángulo central a partir de la entrada.',
      '円周角には整数を入力してください。': 'Introduce un entero para el ángulo inscrito.',
      '円周角は 0° 以上 180° 以下の整数にしてください。': 'Introduce un entero entre 0° y 180° para el ángulo inscrito.',
      '３辺': '3 lados',
      '３角': '3 ángulos',
      '２辺夹角': '2 lados y ángulo incluido',
      '１辺両角': '1 lado y dos ángulos',
      'AI 自動モザイク': 'Mosaico automático con IA',
      '複数画像を自動検出して一括モザイク化': 'Detecta y aplica mosaico a varias imágenes',
      '処理の流れ': 'Flujo',
      '処理設定': 'Ajustes de proceso',
      '出力形式': 'Formato de salida'
    }
  };

  function getUrlLanguage() {
    try {
      const lang = new URL(window.location.href).searchParams.get('lang');
      return dictionaries[lang] ? lang : '';
    } catch (e) {
      return '';
    }
  }

  function getStoredLanguage() {
    try {
      const lang = localStorage.getItem('site-language');
      return dictionaries[lang] ? lang : '';
    } catch (e) {
      return '';
    }
  }

  function getLanguage() {
    if (window.siteI18n && typeof window.siteI18n.getLanguage === 'function') {
      const lang = window.siteI18n.getLanguage();
      if (dictionaries[lang]) return lang;
    }
    return getUrlLanguage() || getStoredLanguage() || 'ja';
  }

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function hasJapanese(text) {
    return /[ぁ-んァ-ン一-龯]/.test(String(text || ''));
  }

  function translateText(text, dict) {
    const key = normalize(text);
    if (!key) return text;
    if (dict[key]) return dict[key];
    let next = key;
    Object.keys(dict).sort(function (a, b) { return b.length - a.length; }).forEach(function (source) {
      if (next.indexOf(source) !== -1) {
        next = next.split(source).join(dict[source]);
      }
    });
    return next === key ? text : next;
  }

  const originalTextNodes = new WeakMap();

  function getOriginalNodeText(node) {
    if (originalTextNodes.has(node)) return originalTextNodes.get(node);
    if (!hasJapanese(node.nodeValue)) return '';
    originalTextNodes.set(node, node.nodeValue);
    return node.nodeValue;
  }

  function translateNodeText(node, lang, dict) {
    if (!node.nodeValue || !normalize(node.nodeValue)) return;
    const original = getOriginalNodeText(node);
    if (!original) return;
    const source = normalize(original);
    const translated = lang === 'ja' ? source : translateText(source, dict);
    if (translated !== normalize(node.nodeValue)) {
      node.nodeValue = original.replace(source, translated);
    }
  }

  function apply() {
    const lang = getLanguage();
    const dict = dictionaries[lang] || {};
    document.documentElement.lang = lang;

    if (document.title) {
      const titleEl = document.querySelector('title');
      if (titleEl && !titleEl.dataset.autoI18nOriginal && hasJapanese(document.title)) {
        titleEl.dataset.autoI18nOriginal = document.title;
      }
      const originalTitle = titleEl ? titleEl.dataset.autoI18nOriginal : '';
      if (originalTitle) {
        document.title = lang === 'ja' ? originalTitle : translateText(originalTitle, dict);
      }
    }

    ['placeholder', 'aria-label', 'title', 'alt'].forEach(function (attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        const value = el.getAttribute(attr);
        const key = 'autoI18nOriginal' + attr.replace(/(^|-)([a-z])/g, function (_match, _dash, letter) {
          return letter.toUpperCase();
        });
        if (!el.dataset[key] && hasJapanese(value)) {
          el.dataset[key] = value;
        }
        const original = el.dataset[key];
        if (!original) return;
        const translated = lang === 'ja' ? original : translateText(original, dict);
        if (translated !== value) el.setAttribute(attr, translated);
      });
    });

    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-i18n],[data-i18n-placeholder]')) return NodeFilter.FILTER_REJECT;
        if (!normalize(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      translateNodeText(node, lang, dict);
    });
  }

  let pending = false;
  function scheduleApply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      apply();
    });
  }

  window.InstantGeometryAutoI18n = {
    apply: apply
  };

  function loadDrawSettings() {
    if (!/(^|\/)draw(?:\/|$)/.test(window.location.pathname)) return;
    if (window.InstantGeometryDrawSettings || document.querySelector('script[data-instant-geometry-draw-settings]')) return;
    const loader = document.currentScript || Array.from(document.scripts).find(function (node) {
      return /(?:^|\/)site-auto-i18n\.js(?:\?|$)/.test(node.src || '');
    });
    const script = document.createElement('script');
    script.src = loader && loader.src ? new URL('draw-settings.js?v=settings-contract-1', loader.src).href : '/assets/draw-settings.js?v=settings-contract-1';
    script.dataset.instantGeometryDrawSettings = '1';
    document.head.appendChild(script);
  }

  document.addEventListener('site-components:ready', apply);
  document.addEventListener('site-language:changed', apply);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      apply();
      loadDrawSettings();
    });
  } else {
    apply();
    loadDrawSettings();
  }

  const observer = new MutationObserver(scheduleApply);
  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title', 'alt']
    });
  }
})();
