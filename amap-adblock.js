// Egern native Amap ad cleaner.
// Adapted from the public RuCu6 Amap rules; no Loon/Surge globals are used.

const EMPTY_ENDPOINTS = [
  /\/alimama\/splash_screen_rt(?:\?|$)/,
  /\/shield\/search\/new_hotword(?:\?|$)/,
  /\/faas\/amap-navigation\/card-service-(?:car-end|route-plan)/,
  /\/shield\/search_poi\/tips_adv(?:\?|$)/,
  /\/ws\/banner\/lists\/(?:\?|$)/,
  /\/v1\/ai_rec\//,
  /\/aos\/main\/page\/product\/list(?:\?|$)/,
  /\/faas\/amap-navigation\/(?:main-page-assets|main-page-location|ridewalk-end-fc|usr-profile-fc\/homeV2)/,
  /\/(?:mapapi\/hint_text\/offline_data|message\/notice\/list)(?:\?|$)/,
  /\/shield\/scene\/recommend(?:\?|$)/,
  /\/valueadded\/weather\/v2(?:\?|$)/,
  /\/msgbox\/pull_mp(?:\?|$)/,
  /\/c3frontend\/af-comment\/contentNearbyCard(?:\?|$)/,
  /\/boss\/order\/car\/(?:feedback\/get_card_questions|feedback\/viptips|king_toolbox_car_bubble|remark\/satisfactionConf|rights_information)/,
  /\/boss\/tips\/onscene_visual_optimization/,
  /\/boss\/(?:pay\/web\/paySuccess\/info\/request|transportation\/diversion\/resource\/driving)/,
];

const POI_MODULES = new Set([
  "CouponBanner", "CouponPush", "activityRecommendation", "adStoreBigBannerModule",
  "adv_compliance_info", "adv_gift", "bigListBizRec", "bottomDescription", "brand_service",
  "brand_shop_bar", "businessQualifications", "carServiceCard", "checkIn", "check_in",
  "cityCardFeed", "city_discount", "claim", "co_branded_card", "collector_guide",
  "commonAiAgent", "commonGoodsShelf", "commonHkfMiniPortal", "common_coupon_bar",
  "common_coupon_card", "comprehensiveEditEntrance", "contributor", "dayTripList",
  "discount_commodity", "divergentRecommendModule", "enhanceCustomerServiceFixedBottom",
  "enhanceCustomerServicePoiModule", "everyOneToSee", "feedback", "ggc_entry",
  "hkfMiniPortal", "hkfCalendarRecommend", "horizontalGoodsShelf", "hospital_strategy",
  "hotPlay", "hotelCoupon", "hotelList", "hotelMustRead", "houseAgentService", "houseList",
  "houseShelf", "image_banner", "kaMarketingCampaign", "kaProductMixServiceShelf",
  "ka_not_enter", "legSameIndustryRecEntrance", "listBizRec_1", "listBizRec_2",
  "matrix_banner", "merchantSettlement", "membership", "mini_hook_shelf", "movie_info",
  "nearbyGoodCar", "nearbyRecommendModule", "nearby_play_rec", "newGuest",
  "newRelatedRecommends", "new_operation_banner", "official_account",
  "official_account_hospital", "operation_banner", "operator_card", "packageShelf",
  "parentBizRec", "parentPoiRecEntrance", "platformCustomerCommonModule",
  "platformCustomerComplianceInfo", "poiDetailBottomBar", "poiDetailBottomBarOperation",
  "poiDetailCommonConfig", "poiDetailNewBeltCardV2", "poiDetailNewBeltV2",
  "poiDetailWaterFeed", "poiDetailWaterFeedTitle", "poster_banner", "portal_entrance",
  "quickLink", "quickLinksPortal", "relatedRecommends", "reviews",
  "sameIndustryRecommendModule", "sameIndustry2RecommendModule", "scenic_coupon",
  "scenic_filter", "scenic_lifeservices", "scenic_mustplay", "scenic_play_guide",
  "scenic_recommend", "scenic_voice", "searchPlaMap", "shopStdActivity", "shopStructGift",
  "shoppingMallEvent", "similarShelfRecommend", "similarShopRecommend", "smallListBizRec",
  "smallOrListBizRec", "societyPublicExperience", "subscription", "thirdparty_info",
  "travelGuideRec", "uploadBar", "upload_bar", "verification", "waistRecEntrance",
  "waterFallFeed", "waterFallFeedTitle", "yellowPageAdRecommendModule",
]);

function removeKeys(target, keys) {
  if (!target || typeof target !== "object") return;
  for (const key of keys) delete target[key];
}

function cleanSearchList(list) {
  if (!list || typeof list !== "object") return;
  removeKeys(list.hookInfo?.data, ["header", "house_info"]);
  removeKeys(list.map_bottom_bar, ["hotel"]);
  removeKeys(list.poi?.item_info?.tips_bottombar_button, ["hotel"]);
  removeKeys(list, ["tips_operation_info"]);
  removeKeys(list.bottom?.bottombar_button, ["hotel"]);
  if (
    (list.card?.card_id === "SearchCardBrand" && list.item_type === "brandAdCard") ||
    (list.card?.card_id === "NearbyGroupBuy" && list.item_type === "toplist") ||
    (list.card?.card_id === "ImageBanner" && list.item_type === "ImageBanner")
  ) {
    delete list.card;
  }
}

function cleanSearchPoi(obj) {
  const direct = obj?.data?.list_data?.content?.[0];
  if (direct) cleanSearchList(direct);

  const districtPoi = obj?.data?.district?.poi_list?.[0];
  removeKeys(districtPoi, ["transportation", "feed_rec_tab"]);

  const nested = obj?.data?.modules?.not_parse_result?.data?.list_data?.content?.[0];
  if (nested) cleanSearchList(nested);

  const listData = obj?.data?.modules?.list_data?.data;
  if (Array.isArray(listData?.content)) {
    listData.content = listData.content.filter(
      (item) => !["brandAdCard", "toplist_al"].includes(item?.item_type),
    );
  }
}

function cleanSuggestions(obj) {
  const isAd = (item) =>
    item?.tip?.datatype_spec === "12" ||
    ["ad", "poi_ad", "toplist"].includes(item?.tip?.result_type) ||
    ["ad", "exct_query_sug_merge_theme", "query_sug_merge_theme", "sp"].includes(item?.tip?.task_tag);

  if (Array.isArray(obj?.tip_list)) obj.tip_list = obj.tip_list.filter((item) => !isAd(item));
  if (Array.isArray(obj?.city_list)) {
    for (const city of obj.city_list) {
      if (Array.isArray(city?.tip_list)) city.tip_list = city.tip_list.filter((item) => !isAd(item));
    }
  }
}

function cleanJson(url, obj) {
  if (url.includes("/marketingOperationStructured")) {
    removeKeys(obj?.data?.tipsOperationLocation, ["obj"]);
    removeKeys(obj?.data, ["resourcePlacement"]);
  } else if (url.includes("/search_poi/homepage")) {
    delete obj.history_tags;
  } else if (url.includes("/sharedtrip/taxi/order_detail_car_tips")) {
    delete obj?.data?.carTips?.data?.popupInfo;
  } else if (url.includes("/aos/perception/publicTravel/beforeNavi")) {
    const common = obj?.data?.common_data;
    for (const key of ["bus_plan_bottom_event", "bus_plan_bottom_tips", "bus_plan_segment_event"]) {
      if (Array.isArray(common?.[key]?.data)) common[key].data = [];
    }
    if (Array.isArray(obj?.data?.front_end?.assistant)) obj.data.front_end.assistant = [];
  } else if (url.includes("/boss/car/order/content_info")) {
    for (const key of ["benefitsCard", "popup", "skin"]) {
      if (Array.isArray(obj?.data?.lubanData?.[key]?.dataList)) obj.data.lubanData[key].dataList = [];
    }
    for (const key of ["c3DiversionCard", "DiversionCard"]) {
      if (Array.isArray(obj?.data?.matrixData?.[key]?.dataList)) obj.data.matrixData[key].dataList = [];
    }
  } else if (url.includes("/boss/order_web/friendly_information")) {
    removeKeys(obj?.data?.["105"], ["banners", "carouselTips", "integratedBanners", "integratedTips", "skins", "skinAndTips", "tips"]);
  } else if (url.includes("/bus/plan/integrate")) {
    if (Array.isArray(obj?.data?.banner_lists?.data)) obj.data.banner_lists.data = [];
    if (Array.isArray(obj?.data?.banner_lists?.tips)) obj.data.banner_lists.tips = [];
    if (Array.isArray(obj?.data?.mixed_plans?.data?.taxiPlans)) obj.data.mixed_plans.data.taxiPlans = [];
  } else if (url.includes("/c3frontend/af-hotel/page/main")) {
    const modules = obj?.data?.modules;
    removeKeys(modules, ["CouponPortalCard", "CouponWidget", "recommended_list"]);
    removeKeys(modules?.user_filter_card?.data, ["banner", "bannerList", "service_data", "sug_items_data"]);
    delete modules?.user_filter_card?.data?.search_button_data?.rightbgText;
  } else if (url.includes("/c3frontend/af-launch/page/main")) {
    if (obj?.data?.modules?.C1EndNaviEngine) obj.data.modules.C1EndNaviEngine.data = {};
  } else if (url.includes("/c3frontend/af-nearby/nearby")) {
    if (obj?.data?.modules?.banner) obj.data.modules.banner = {};
    if (obj?.data?.modules?.contentPoster) obj.data.modules.contentPoster = {};
  } else if (url.includes("/card-service-plan-home")) {
    if (Array.isArray(obj?.data?.children)) obj.data.children = obj.data.children.filter((item) => !Object.hasOwn(item, "schema"));
  } else if (url.includes("/faas/amap-navigation/main-page")) {
    if (Array.isArray(obj?.data?.cardList)) {
      obj.data.cardList = obj.data.cardList.filter((item) => ["ContinueNavigationCard", "FrequentLocation", "LoginCard"].includes(item?.dataKey));
    }
    if (Array.isArray(obj?.data?.mapBizList)) obj.data.mapBizList = obj.data.mapBizList.filter((item) => item?.dataKey === "FindCarVirtualCard");
  } else if (url.includes("/perception/drive/routeInfo") || url.includes("/perception/drive/routePlan")) {
    const front = obj?.data?.front_end;
    removeKeys(front, ["assistant", "global_guide_data", "route_search", "start_button_tips"]);
    if (Array.isArray(front?.guide_tips)) front.guide_tips = front.guide_tips.filter((item) => item?.biz_type !== "music");
    for (const list of [obj?.data?.tbt?.event, front?.download]) {
      if (Array.isArray(list)) {
        const cleaned = list.filter((item) => !/ads-\d+/.test(item?.dynamic_id_s || ""));
        if (list === obj?.data?.tbt?.event) obj.data.tbt.event = cleaned;
        else front.download = cleaned;
      }
    }
  } else if (url.includes("/promotion-web/resource")) {
    removeKeys(obj?.data, ["alpha", "banner", "bravo", "bubble", "charlie", "icon", "other", "popup", "push", "tips"]);
  } else if (url.includes("/shield/dsp/profile/index/nodefaasv3")) {
    removeKeys(obj?.data, ["tipData", "memberInfo", "topMixedCard"]);
    if (Array.isArray(obj?.data?.cardList)) obj.data.cardList = obj.data.cardList.filter((item) => item?.dataKey === "MyOrderCard");
  } else if (url.includes("/shield/frogserver/aocs/updatable/")) {
    const keys = [
      "EndNaviC3AdCard", "Naviendpage_Searchwords", "SplashScreenControl", "TipsTaxiButton",
      "amapCoin", "favorites_info", "feedback_banner", "footprint", "his_input_tip",
      "home_business_position_config", "hotel_activity", "hotel_fillin_opt", "hotel_loop",
      "hotel_tipsicon", "hotsaleConfig", "landing_page_info", "map_weather_switch", "maplayers",
      "navi_end", "nearby_business_popup", "nearby_map_entry_guide", "nearby_map_pull_down_guide",
      "operation_layer", "poi_rec", "route_banner", "routeresult_banner", "sportsGroupConfig",
      "sportsHealthConfig", "sportsHomeConfig", "sportsRouteConfig", "sportsTaskConfig",
      "sports_walk", "small_biz_b2b_kb", "small_biz_case", "small_biz_fun", "small_biz_index",
      "small_biz_news", "splashscreen", "splashview_config", "sur_bar", "taxi_activity",
      "testflight_adiu", "tf_remind", "tips_bar_black_list", "vip",
    ];
    for (const key of keys) {
      if (obj?.data?.[key] !== undefined) obj.data[key] = { status: 1, version: "", value: "" };
    }
  } else if (url.includes("/shield/search/common/coupon/info")) {
    if (obj?.data) obj.data = {};
  } else if (url.includes("/shield/search/nearbyrec_smart")) {
    const allowed = new Set(["head", "search_hot_words", "feed_rec"]);
    if (Array.isArray(obj?.data?.modules)) obj.data.modules = obj.data.modules.filter((item) => allowed.has(item));
  } else if (url.includes("/shield/search/poi/detail")) {
    const modules = obj?.data?.modules;
    delete modules?.combineReviews?.data?.write_comment;
    for (const key of POI_MODULES) delete modules?.[key];
  } else if (url.includes("/shield/search_bff/hotword")) {
    if (Array.isArray(obj?.data?.headerHotWord)) obj.data.headerHotWord = [];
  } else if (url.includes("/shield/search_poi/search/sp") || url.includes("/shield/search_poi/mps")) {
    cleanSearchPoi(obj);
  } else if (url.includes("/shield/search_poi/sug")) {
    cleanSuggestions(obj);
  } else if (url.includes("/shield/search_poi/tips_operation_location")) {
    delete obj?.data?.coupon;
    removeKeys(obj?.data?.modules, [
      "belt", "common_float_bar", "common_image_banner", "coupon_discount_float_bar",
      "coupon_float_bar", "discount_coupon", "image_cover_bar", "mood_coupon_banner",
      "operation_brand", "promotion_wrap_card", "tips_top_banner",
    ]);
  } else if (url.includes("/valueadded/alimama/splash_screen")) {
    for (const ad of obj?.data?.ad || []) {
      if (ad?.set?.setting) ad.set.setting.display_time = 0;
      if (ad?.creative?.[0]) {
        ad.creative[0].start_time = 3818332800;
        ad.creative[0].end_time = 3818419199;
      }
    }
  }
  return obj;
}

export default async function amapAdblock(ctx) {
  const url = ctx.request?.url || "";

  if (ctx.response) {
    try {
      const data = await ctx.response.json();
      return { body: cleanJson(url, data) };
    } catch {
      return;
    }
  }

  const userAgent = ctx.request?.headers?.get?.("user-agent") || "";
  if (/\/amdc\/mobileDispatch/.test(url) && /^AMapiPhone/i.test(userAgent)) return ctx.abort();
  if (EMPTY_ENDPOINTS.some((pattern) => pattern.test(url))) {
    return ctx.respond({
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: {},
    });
  }
}
