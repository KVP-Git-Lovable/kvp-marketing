-- Enable gamification module
INSERT INTO performance_module_config (active_module)
VALUES ('both')
ON CONFLICT (id) DO UPDATE SET active_module = 'both';

-- Enable packing list module
INSERT INTO feature_flags (feature_key, feature_name, is_enabled)
VALUES ('packing_list_module', 'Packing List Module', true)
ON CONFLICT (feature_key) DO UPDATE SET is_enabled = true;

-- Enable delivery agent app
INSERT INTO feature_flags (feature_key, feature_name, is_enabled)
VALUES ('delivery_agent_app', 'Delivery Agent App', true)
ON CONFLICT (feature_key) DO UPDATE SET is_enabled = true;