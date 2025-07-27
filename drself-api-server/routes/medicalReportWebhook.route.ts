import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ResponseHandler } from '../utils/responseHandler';

const router = Router();

router.post('/medical-report-webhook', async (req, res) => {
  console.log('Medical report webhook endpoint triggered');
  try {
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const payload = req.body;
    console.log('Webhook payload received:', JSON.stringify(payload, null, 2));

    if ((payload.type === 'INSERT' || payload.type === 'UPDATE') && payload.record && payload.record.file_url) {
      const fileUrl = payload.record.file_url;
      const userId = payload.record.user_id; // Use user_id instead of id (which is the medical report ID)

      console.log(`Processing record for user: ${userId}, file: ${fileUrl}`);

      if (!userId) {
        console.log('No user_id found in the medical report');
        return res.status(400).json({ success: false, error: 'No user_id found' });
      }

      // First, let's check what we're querying for
      console.log(`Querying profiles table for id: ${userId}`);
      
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('buildup_user_id, id')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        
        // Let's also check what profiles exist in the database
        const { data: allProfiles, error: listError } = await supabaseClient
          .from('profiles')
          .select('id, buildup_user_id')
          .limit(5);
        
        if (listError) {
          console.error('Error listing profiles:', listError);
        } else {
          console.log('Available profiles (first 5):', allProfiles);
        }
        
        return res.status(500).json({ 
          success: false, 
          error: 'Profile fetch error', 
          details: profileError.message,
          searched_for: userId
        });
      }

      if (profileData && profileData.buildup_user_id) {
        console.log(`Valid update detected for user with buildup_user_id: ${profileData.buildup_user_id}`);
        try {
          // Prepare the payload for Buildup gateway according to their expected structure
          const buildupPayload = {
            patient_info: {
              userId: userId,
              email: "test@example.com", // Placeholder
              gender: "Male", // Placeholder
              age: 30, // Placeholder
              date_of_birth: "1993-01-01", // Placeholder
              date: payload.record.report_date || new Date().toISOString(),
              blood_group: "A", // Placeholder
              weight_kg: 70, // Placeholder
              height_m: 1.75 // Placeholder
            },
            oxidative_stress: {
              Oxidative_Aggression: {
                score: 50,
                status: "acceptable"
              },
              Antioxidant_Protection: {
                score: 60,
                status: "good"
              }
            },
            anti_aging_skin: {
              Elasticity_Texture: {
                score: 65,
                status: "good"
              },
              Aging_Condition: {
                score: 55,
                status: "acceptable"
              },
              Fragility: {
                score: 70,
                status: "good"
              }
            },
            slimness: {
              Fat_Excess: {
                score: 45,
                status: "acceptable"
              },
              Aqueous_Cellulitis_Tendency: 25.5,
              Adipose_Cellulitis_Tendency: 20.2,
              Fibrous_Cellulitis_Tendency: 15.3
            },
            hair_nails: {
              Falling_Tendency: {
                score: 55,
                status: "acceptable"
              },
              Quality: {
                score: 65,
                status: "good"
              }
            },
            joints: {
              Flexibility: {
                score: 60,
                status: "good"
              },
              Acid_Base_Balance: {
                score: 55,
                status: "acceptable"
              },
              Tissue_Repair: {
                score: 70,
                status: "good"
              }
            },
            detoxification: {
              Sulfoconjugation_Index: {
                score: 65,
                status: "good"
              },
              Overall_Intoxication: {
                score: 55,
                status: "acceptable"
              },
              Metabolic_Overload: {
                score: 60,
                status: "good"
              }
            },
            digestion: {
              Trace_Mineral_Assimilation: {
                score: 70,
                status: "good"
              },
              Enzymatic_Balance: {
                score: 65,
                status: "good"
              },
              Glycemic_Balance: {
                score: 55,
                status: "acceptable"
              }
            },
            mental_condition: {
              Cognitive_Function: {
                score: 70,
                status: "good"
              },
              Emotional_Balance: {
                score: 65,
                status: "good"
              },
              Nervous_System: {
                score: 75,
                status: "good"
              }
            },
            general_balance: {
              Natural_Defenses: {
                score: 70,
                status: "good"
              },
              Hormonal_Balance: {
                score: 65,
                status: "good"
              },
              Cardiovascular: {
                score: 60,
                status: "good"
              },
              Predisposition_for_Allergies: {
                score: 25,
                status: "good"
              }
            },
            providerFindings: payload.record.life_style || "Medical report analysis completed",
            providerRecommendations: payload.record.life_recommendation || "Follow up with healthcare provider"
          };

          console.log('Sending to Buildup gateway:', JSON.stringify(buildupPayload, null, 2));
          console.log('Payload size:', JSON.stringify(buildupPayload).length);
          console.log('Is valid JSON:', JSON.stringify(buildupPayload));

          // Add authentication headers
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjlFRTcxNzY2RDJFQkI2MUQ2MEEwMDFENUFDMTkyMThFIiwidHlwIjoiYXQrand0In0.eyJpc3MiOiJodHRwczovL3N0cy54LWluaXR5LmNvbSIsIm5iZiI6MTc1MzU3NDg2MSwiaWF0IjoxNzUzNTc0ODYxLCJleHAiOjE3NTM1ODIwNjEsInNjb3BlIjpbImhlYWx0aEluc2lnaHRzLnN1Ym1pdCIsInVzZXJzLnJlZ2lzdGVyIiwidXNlcnMudmFsaWRhdGUiXSwiY2xpZW50X2lkIjoiZHJfc2VsZiIsImp0aSI6IkE5NDEwMkYzNDg4QUNENUI2M0RFNTY2OEQ0MjhBMEVEIn0.qy2aVIDDTxtrAwgiA0Rc7k-RR4jR6yE7G_AZUsGrNlWYVIBC2fEvM6NwscCq82te_PryY8b5IMLB9X7_wjgthrD1m5TznBAWYF5343l116yx9o6Gt7wAGrSh3odpuYCF97DP0G7HQLUUKl6l7k4I__j25a20nh4QLG8jaQhH4u2mp6bD3Wq-kPZhArYEN_3i_F-3-VdKwb1h5_f4U4XJkt227Q1-rTPe8GJbxT5Zh4a9wX1vpLbsZUMt0QbyfnuxJ3BFW2E8Y5hIp2aPOtPykGsuCCxhZUu01vmCYS7_QiielldC0A0mhs_w4U_hLpZPQ95yJgoWqDYP0uv8Kz5gBA'
          };

          console.log('Request headers:', headers);

          const webhookResponse = await fetch(
            'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit',
            {
              method: 'POST',
              headers,
              body: JSON.stringify(buildupPayload)
            }
          );

          // Handle large responses using the ResponseHandler
          const webhookResult = await webhookResponse.text();
          console.log('Buildup gateway status:', webhookResponse.status);
          console.log('Buildup gateway response:', webhookResult);
          console.log('Buildup gateway response length:', webhookResult.length);

          const responseHandler = new ResponseHandler({
            maxSize: 2000, // 2KB limit
            storageMethod: 'database' // or 'file' or 'both'
          });

          const responseInfo = await responseHandler.handleLargeResponse(
            webhookResult,
            userId,
            webhookResponse.status
          );

          return res.json({
            success: true,
            url: fileUrl,
            buildup_gateway_called: true,
            buildup_response_summary: responseInfo.summary,
            buildup_response_id: responseInfo.fullResponse,
            buildup_status: webhookResponse.status,
            response_size: responseInfo.responseSize,
            storage_method: responseInfo.storageMethod,
            sent_to: 'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit'
          });
        } catch (webhookError: any) {
          console.error('Error calling Buildup gateway:', webhookError);
          return res.status(500).json({
            success: false,
            url: fileUrl,
            buildup_gateway_called: false,
            buildup_error: webhookError.message,
            sent_to: 'https://Buildup-gateway.x-inity.com/IntegrationAPI/v1/HealthInsights/Submit'
          });
        }
      } else {
        console.log('User does not have a buildup_user_id in profiles');
        return res.json({
          success: false,
          message: 'User does not have buildup_user_id'
        });
      }
    } else {
      console.log('No file_url found or invalid event type');
      return res.json({
        success: false,
        message: 'No file_url found or invalid event type'
      });
    }
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 