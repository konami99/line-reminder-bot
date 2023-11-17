import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, QueryCommand, Select } from "@aws-sdk/client-dynamodb";
import { Client } from "@upstash/qstash";
import { DateTime } from "luxon";
import {
  ClientConfig,
  MessageAPIResponseBase,
  messagingApi,
  middleware,
  MiddlewareConfig,
  webhook,
} from '@line/bot-sdk';
import { DynamoDBDocumentClient, PutCommand, PutCommandInput, QueryCommandOutput, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from "ulid"

export class DynamoDBCRUDs {
  static async scheduledRemindersCount(userId: string): Promise<QueryCommandOutput> {
    const queryItemParams = {
      TableName: 'line-reminders',
      IndexName: 'UseridStatusIndex', // Replace with your GSI name
      KeyConditionExpression: 'user_id = :uid AND #status = :status', // Define your conditions
      ExpressionAttributeNames: {
        '#status': 'status', // Replace 'status' with the attribute in the GSI
      },
      ExpressionAttributeValues: {
        ':uid': { 'S': userId},
        ':status': { 'S': 'scheduled'}, // Replace with the status value you're querying
      },
      Select: Select.COUNT
    };

    const getClient = new DynamoDBClient({
      region: 'us-west-2' as string,
    });
    //const dbDocClient = DynamoDBDocumentClient.from(client);
    //const data = await dbDocClient.send(new UpdateCommand(params));
    const numberOfItems = await getClient.send(new QueryCommand(queryItemParams))
    return numberOfItems;
  }
}